import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { Notification } from '../models/Notification.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { JOB_STATUSES, ASSIGNMENT_STATUSES } from '../config/constants.js';

const PENDING_APPLICATION_STATUSES = ['APPLIED', 'SHORTLISTED', 'OFFERED', 'ACCEPTED'];

export const deleteMyAccount = async (req, res, next) => {
  const { password, confirmation } = req.body || {};
  if (typeof password !== 'string' || !password || confirmation !== 'DELETE') {
    return res.status(400).json({
      success: false,
      message: 'Your current password and the exact confirmation text DELETE are required.'
    });
  }

  let session;
  let blockedByActiveAssignment = false;
  try {
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const account = await User.findById(req.user._id).session(session);
      if (!account || account.accountStatus === 'deleted') {
        const error = new Error('This account has already been deleted or is unavailable.');
        error.statusCode = 404;
        throw error;
      }

      if (!(await account.comparePassword(password))) {
        const error = new Error('The current password is incorrect.');
        error.statusCode = 401;
        throw error;
      }

      const activeAssignment = await Assignment.exists({
        $or: [{ worker: account._id }, { employer: account._id }],
        status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] }
      }).session(session);

      if (activeAssignment) {
        blockedByActiveAssignment = true;
        const error = new Error('Resolve or cancel all confirmed and in-progress shifts before deleting this account.');
        error.statusCode = 409;
        throw error;
      }

      if (account.role === 'employer') {
        const employerJobs = await Job.find({
          employer: account._id,
          status: { $nin: [JOB_STATUSES.COMPLETED, JOB_STATUSES.CANCELLED] }
        }).select('_id title').session(session).lean();
        const employerJobIds = employerJobs.map((job) => job._id);

        if (employerJobIds.length > 0) {
          const affectedApplications = await Application.find({
            job: { $in: employerJobIds },
            status: { $in: PENDING_APPLICATION_STATUSES }
          }).select('worker job').session(session).lean();

          await Job.updateMany(
            { _id: { $in: employerJobIds } },
            { $set: { status: JOB_STATUSES.CANCELLED } },
            { session }
          );
          await Application.updateMany(
            { job: { $in: employerJobIds }, status: { $in: PENDING_APPLICATION_STATUSES } },
            {
              $set: { status: 'CANCELLED' },
              $push: {
                decisionHistory: {
                  status: 'CANCELLED',
                  note: 'Employer account deleted; job posting closed.',
                  changedBy: account._id,
                  timestamp: new Date()
                }
              }
            },
            { session }
          );

          const jobTitles = new Map(employerJobs.map((job) => [job._id.toString(), job.title]));
          const notifications = affectedApplications.map((application) => ({
            recipient: application.worker,
            type: 'APPLICATION_STATUS',
            title: `Job Cancelled: ${jobTitles.get(application.job.toString()) || 'Job posting'}`,
            message: 'This job posting has been closed because the employer account was deleted.',
            link: '/worker/applications',
            relatedResource: { resourceType: 'Job', resourceId: application.job }
          }));
          if (notifications.length > 0) {
            await Notification.insertMany(notifications, { session });
          }
        }
      }

      if (account.role === 'worker') {
        const applications = await Application.find({
          worker: account._id,
          status: { $in: PENDING_APPLICATION_STATUSES }
        }).populate('job', 'title employer').session(session);

        for (const application of applications) {
          application.status = 'WITHDRAWN';
          application.decisionHistory.push({
            status: 'WITHDRAWN',
            note: 'Worker account deleted; application withdrawn.',
            changedBy: account._id,
            timestamp: new Date()
          });
          await application.save({ session });
          if (application.job?.employer) {
            await Notification.create([{
              recipient: application.job.employer,
              type: 'APPLICATION_STATUS',
              title: `Application Withdrawn: ${application.job.title}`,
              message: 'An applicant withdrew their application because their WorkMatch account was deleted.',
              link: `/employer/jobs/${application.job._id}/applicants`,
              relatedResource: { resourceType: 'Job', resourceId: application.job._id }
            }], { session });
          }
        }
      }

      await WorkerProfile.deleteOne({ user: account._id }, { session });
      await EmployerProfile.deleteOne({ user: account._id }, { session });
      await Notification.deleteMany({ recipient: account._id }, { session });
      await VerificationRequest.updateMany(
        { user: account._id },
        { $unset: { submittedData: 1 } },
        { session }
      );

      await User.updateOne(
        { _id: account._id },
        {
          $set: {
            name: 'Deleted Account',
            email: `deleted-${account._id}@deleted.invalid`,
            passwordHash: crypto.randomBytes(48).toString('hex'),
            accountStatus: 'deleted',
            emailVerified: false,
            verificationStatus: 'unverified'
          },
          $unset: {
            emailVerificationToken: 1,
            emailVerificationExpires: 1,
            resetPasswordToken: 1,
            resetPasswordExpires: 1,
            lastLogin: 1
          },
          $inc: { tokenVersion: 1 }
        },
        { session }
      );
    });

    return res.status(200).json({
      success: true,
      message: 'Your account has been deleted successfully.'
    });
  } catch (error) {
    if (blockedByActiveAssignment && error.statusCode === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    if (session) await session.endSession();
  }
};