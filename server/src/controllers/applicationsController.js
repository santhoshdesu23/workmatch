import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { User } from '../models/User.js';
import { APPLICATION_STATUSES, ASSIGNMENT_STATUSES, JOB_STATUSES, PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { computeJobMatch } from '../services/matchingService.js';
import { createNotification } from '../services/notificationService.js';
import { getShiftInterval, shiftsOverlap } from '../utils/scheduleUtils.js';

export const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const workerId = req.user._id;
    const { message = '' } = req.body;

    // Enforce mandatory email verification for workers before applying
    const worker = await User.findById(workerId);
    if (!worker || !worker.emailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required before you can apply to shifts. Please verify your email address.'
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.status !== JOB_STATUSES.OPEN) {
      return res.status(400).json({ success: false, message: `Cannot apply: job status is ${job.status}.` });
    }

    if (new Date(job.applicationDeadline) < new Date()) {
      return res.status(400).json({ success: false, message: 'The application deadline for this job has expired.' });
    }

    if (job.filledCount >= job.openings) {
      return res.status(400).json({ success: false, message: 'All openings for this job are currently filled.' });
    }

    // Check duplicate application
    const existing = await Application.findOne({ job: jobId, worker: workerId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You have already submitted an application for this position (Current status: ${existing.status}).`
      });
    }

    // Check schedule conflicts using true shift-interval overlap detection
    const targetInterval = getShiftInterval(job.workDate, job.startTime, job.endTime);

    // Look for active assignments within ±2 days (to account for overnight shifts & timezone boundaries)
    const windowStart = new Date(job.workDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 2);
    const windowEnd = new Date(job.workDate);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

    const activeAssignments = await Assignment.find({
      worker: workerId,
      status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] },
      'agreedSchedule.workDate': { $gte: windowStart, $lte: windowEnd }
    }).populate('job', 'title');

    for (const assignment of activeAssignments) {
      if (assignment.agreedSchedule?.startTime && assignment.agreedSchedule?.endTime) {
        try {
          const assignedInterval = getShiftInterval(
            assignment.agreedSchedule.workDate,
            assignment.agreedSchedule.startTime,
            assignment.agreedSchedule.endTime
          );

          if (shiftsOverlap(targetInterval, assignedInterval)) {
            const conflictJobTitle = assignment.job?.title || 'an existing shift';
            return res.status(409).json({
              success: false,
              message: `Schedule conflict: This shift (${job.startTime}–${job.endTime}) overlaps with your confirmed shift for "${conflictJobTitle}" (${assignment.agreedSchedule.startTime}–${assignment.agreedSchedule.endTime}).`
            });
          }
        } catch (err) {
          console.warn('[Schedule] Skipped malformed assignment interval:', err.message);
        }
      }
    }

    const application = await Application.create({
      job: jobId,
      worker: workerId,
      status: APPLICATION_STATUSES.APPLIED,
      message: String(message || '').slice(0, 1000),
      decisionHistory: [
        {
          status: APPLICATION_STATUSES.APPLIED,
          note: 'Application submitted voluntarily by worker',
          changedBy: workerId
        }
      ]
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { applicationsCount: 1 } });

    // Notify employer
    await createNotification({
      recipient: job.employer,
      type: 'APPLICATION_STATUS',
      title: `New applicant for "${job.title}"`,
      message: `${req.user.name} applied for your opening. Review their profile and match score.`,
      link: `/employer/jobs/${jobId}/applicants`,
      relatedResource: { resourceType: 'Job', resourceId: job._id }
    });

    res.status(201).json({
      success: true,
      message: 'Your application has been voluntarily submitted to the employer.',
      application
    });
  } catch (error) {
    next(error);
  }
};

export const getMyApplications = async (req, res, next) => {
  try {
    const isWorker = req.user.role === ROLES.WORKER;
    const filter = isWorker ? { worker: req.user._id } : { employer: req.user._id };

    const applications = await Application.find(filter)
      .populate({
        path: 'job',
        populate: { path: 'employer', select: 'name email' }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      applications
    });
  } catch (error) {
    next(error);
  }
};

export const getJobApplicants = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view applicants for this job.' });
    }

    const applications = await Application.find({ job: jobId })
      .populate('worker', 'name email verificationStatus lastLogin')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch worker profiles to calculate compatibility score and show skills
    const workerIds = applications.map((a) => a.worker?._id).filter(Boolean);
    const profiles = await WorkerProfile.find({ user: { $in: workerIds } }).lean();
    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.user.toString(), p));

    const enrichedApplicants = applications.map((app) => {
      const workerProf = profileMap.get(app.worker?._id?.toString());
      let matchData = null;
      if (workerProf) {
        matchData = computeJobMatch(workerProf, job);
      }

      return {
        ...app,
        workerProfile: workerProf,
        matchData
      };
    });

    res.status(200).json({
      success: true,
      job,
      applicants: enrichedApplicants
    });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status, note = '', offerDetails } = req.body;

    const application = await Application.findById(applicationId).populate('job');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const job = application.job;
    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this application.' });
    }

    if (!Object.values(APPLICATION_STATUSES).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid target status: ${status}.` });
    }

    // Server-enforced hiring capacity and invariant safeguards
    if (status === APPLICATION_STATUSES.HIRED) {
      if (application.status === APPLICATION_STATUSES.HIRED) {
        return res.status(400).json({
          success: false,
          message: 'Candidate is already hired for this position.'
        });
      }

      if (job.filledCount >= job.openings) {
        return res.status(400).json({
          success: false,
          message: 'Hiring capacity reached: All openings for this job are already filled.'
        });
      }

      if (job.status === JOB_STATUSES.CANCELLED || job.status === JOB_STATUSES.COMPLETED) {
        return res.status(400).json({
          success: false,
          message: `Cannot hire for a ${job.status.toLowerCase()} job posting.`
        });
      }

      if (application.status === APPLICATION_STATUSES.WITHDRAWN) {
        return res.status(400).json({
          success: false,
          message: 'Cannot hire a candidate who voluntarily withdrew their application.'
        });
      }

      // 1. Atomically lock the application state so concurrent requests cannot double-hire
      const lockedApp = await Application.findOneAndUpdate(
        {
          _id: applicationId,
          status: { $in: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.OFFERED, APPLICATION_STATUSES.ACCEPTED] }
        },
        {
          $set: { status: APPLICATION_STATUSES.HIRED },
          $push: {
            decisionHistory: {
              status: APPLICATION_STATUSES.HIRED,
              note: String(note || 'Applicant hired').slice(0, 500),
              changedBy: req.user._id,
              timestamp: new Date()
            }
          }
        },
        { new: true }
      );

      if (!lockedApp) {
        const currentApp = await Application.findById(applicationId);
        if (currentApp && currentApp.status === APPLICATION_STATUSES.HIRED) {
          return res.status(409).json({
            success: false,
            message: 'Candidate is already hired for this position.'
          });
        }
        return res.status(409).json({
          success: false,
          message: `Cannot hire candidate in current status: ${currentApp?.status || 'unknown'}.`
        });
      }

      // 2. Atomic conditional update to allocate capacity
      const updatedJob = await Job.findOneAndUpdate(
        { _id: job._id, filledCount: { $lt: job.openings } },
        { $inc: { filledCount: 1 } },
        { new: true }
      );

      if (!updatedJob) {
        // Rollback application status back to original state
        await Application.findByIdAndUpdate(applicationId, {
          status: application.status,
          $pop: { decisionHistory: 1 }
        });
        return res.status(409).json({
          success: false,
          message: 'Hiring capacity reached: All openings for this job are already filled.'
        });
      }

      // Check if job is now fully filled
      if (updatedJob.filledCount >= updatedJob.openings) {
        await Job.findByIdAndUpdate(job._id, { status: JOB_STATUSES.FILLED });
      }

      // 3. Create confirmed Assignment with unique compound index protection
      let assignment;
      try {
        assignment = await Assignment.create({
          job: job._id,
          worker: application.worker,
          employer: job.employer,
          application: application._id,
          agreedSchedule: {
            workDate: job.workDate,
            startTime: job.startTime,
            endTime: job.endTime,
            totalHours: job.totalHours
          },
          agreedPayment: {
            grossAmount: job.grossPay,
            currency: job.currency,
            basis: job.payBasis
          },
          status: ASSIGNMENT_STATUSES.CONFIRMED
        });
      } catch (assignErr) {
        // Compensate: decrement filledCount & reset application status
        await Job.findByIdAndUpdate(job._id, {
          $inc: { filledCount: -1 },
          status: JOB_STATUSES.OPEN
        });
        await Application.findByIdAndUpdate(applicationId, {
          status: application.status,
          $pop: { decisionHistory: 1 }
        });

        if (assignErr.code === 11000) {
          return res.status(409).json({
            success: false,
            message: 'Worker already has an active assignment for this job.'
          });
        }
        throw assignErr;
      }

      // 4. Create initial Payment Record tied to this assignment
      try {
        await PaymentRecord.create({
          assignment: assignment._id,
          job: job._id,
          worker: application.worker,
          employer: job.employer,
          amount: job.grossPay,
          currency: job.currency,
          basis: job.payBasis,
          status: PAYMENT_STATUSES.DUE,
          expectedDate: job.workDate,
          paymentMethod: job.paymentMethod,
          verificationSource: 'employer_recorded'
        });
      } catch (payErr) {
        // Compensate: delete assignment, decrement filledCount, reset application status
        await Assignment.findByIdAndDelete(assignment._id);
        await Job.findByIdAndUpdate(job._id, {
          $inc: { filledCount: -1 },
          status: JOB_STATUSES.OPEN
        });
        await Application.findByIdAndUpdate(applicationId, {
          status: application.status,
          $pop: { decisionHistory: 1 }
        });
        throw payErr;
      }

      await EmployerProfile.findOneAndUpdate(
        { user: job.employer },
        { $inc: { totalHiredWorkers: 1 } }
      );

      // In-app notification to the worker
      await createNotification({
        recipient: application.worker,
        type: 'SHIFT_UPCOMING',
        title: `Application Accepted: ${job.title}`,
        message: `Congratulations! You were hired for "${job.title}". Shift: ${job.startTime}–${job.endTime}.`,
        link: `/worker/applications`
      });

      return res.status(200).json({
        success: true,
        message: 'Applicant successfully hired.',
        application: lockedApp
      });
    }

    application.status = status;
    if (offerDetails && status === APPLICATION_STATUSES.OFFERED) {
      application.offerDetails = {
        offeredAt: new Date(),
        note: offerDetails.note || '',
        expiresAt: offerDetails.expiresAt || null
      };
    }

    application.decisionHistory.push({
      status,
      note: String(note || '').slice(0, 500),
      changedBy: req.user._id,
      timestamp: new Date()
    });

    await application.save();

    // In-app notification to the worker
    await createNotification({
      recipient: application.worker,
      type: status === APPLICATION_STATUSES.HIRED ? 'SHIFT_UPCOMING' : 'APPLICATION_STATUS',
      title: `Application Update: ${job.title}`,
      message: `Your application status was updated to ${status}. ${note ? `Note: "${note}"` : ''}`,
      link: `/worker/applications`
    });

    res.status(200).json({
      success: true,
      message: `Applicant marked as ${status}.`,
      application
    });
  } catch (error) {
    next(error);
  }
};

export const withdrawApplication = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (application.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to withdraw this application.' });
    }

    if (application.status === APPLICATION_STATUSES.HIRED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw an already confirmed hire directly. Please notify employer and request shift cancellation.'
      });
    }

    if (application.status === APPLICATION_STATUSES.WITHDRAWN) {
      return res.status(400).json({
        success: false,
        message: 'Application has already been withdrawn.'
      });
    }

    application.status = APPLICATION_STATUSES.WITHDRAWN;
    application.decisionHistory.push({
      status: APPLICATION_STATUSES.WITHDRAWN,
      note: 'Voluntarily withdrawn by worker',
      changedBy: req.user._id,
      timestamp: new Date()
    });
    await application.save();

    await Job.findByIdAndUpdate(application.job, { $inc: { applicationsCount: -1 } });

    res.status(200).json({
      success: true,
      message: 'Application voluntarily withdrawn.',
      application
    });
  } catch (error) {
    next(error);
  }
};

export const respondToOffer = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { accept, reason = '' } = req.body;

    const application = await Application.findById(applicationId).populate('job');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (application.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (application.status !== APPLICATION_STATUSES.OFFERED) {
      return res.status(400).json({ success: false, message: 'No pending offer for this application.' });
    }

    const newStatus = accept ? APPLICATION_STATUSES.ACCEPTED : APPLICATION_STATUSES.REJECTED;
    application.status = newStatus;
    application.decisionHistory.push({
      status: newStatus,
      note: accept ? 'Offer accepted by candidate' : `Offer declined: ${reason}`,
      changedBy: req.user._id,
      timestamp: new Date()
    });
    await application.save();

    // Notify employer
    await createNotification({
      recipient: application.job.employer,
      type: 'APPLICATION_STATUS',
      title: `Offer ${accept ? 'Accepted' : 'Declined'}: ${application.job.title}`,
      message: `${req.user.name} has ${accept ? 'accepted' : 'declined'} your offer.`,
      link: `/employer/jobs/${application.job._id}/applicants`
    });

    res.status(200).json({
      success: true,
      message: `Offer ${accept ? 'accepted' : 'declined'} successfully.`,
      application
    });
  } catch (error) {
    next(error);
  }
};
