import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { APPLICATION_STATUSES, ASSIGNMENT_STATUSES, JOB_STATUSES, PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { computeJobMatch } from '../services/matchingService.js';
import { createNotification } from '../services/notificationService.js';

export const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const workerId = req.user._id;
    const { message = '' } = req.body;

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

    // Check duplicate
    const existing = await Application.findOne({ job: jobId, worker: workerId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You have already submitted an application for this position (Current status: ${existing.status}).`
      });
    }

    const application = await Application.create({
      job: jobId,
      worker: workerId,
      status: APPLICATION_STATUSES.APPLIED,
      message,
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
    const applications = await Application.find({ worker: req.user._id })
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
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (!Object.values(APPLICATION_STATUSES).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid target status.' });
    }

    // Server-enforced hiring capacity safeguard
    if (status === APPLICATION_STATUSES.HIRED) {
      // Atomic conditional update to prevent over-filling openings
      const updatedJob = await Job.findOneAndUpdate(
        { _id: job._id, filledCount: { $lt: job.openings } },
        { $inc: { filledCount: 1 } },
        { new: true }
      );

      if (!updatedJob) {
        return res.status(400).json({
          success: false,
          message: 'Hiring capacity reached: All openings for this job are already filled.'
        });
      }

      // Check if now fully filled
      if (updatedJob.filledCount >= updatedJob.openings) {
        await Job.findByIdAndUpdate(job._id, { status: JOB_STATUSES.FILLED });
      }

      // Create official confirmed Assignment
      const assignment = await Assignment.create({
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

      // Create initial Payment Record
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
        paymentMethod: job.paymentMethod
      });

      await EmployerProfile.findOneAndUpdate(
        { user: job.employer },
        { $inc: { totalHiredWorkers: 1 } }
      );
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
      note,
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
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (application.status === APPLICATION_STATUSES.HIRED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw an already confirmed hire directly. Please notify employer and request shift cancellation.'
      });
    }

    application.status = APPLICATION_STATUSES.WITHDRAWN;
    application.decisionHistory.push({
      status: APPLICATION_STATUSES.WITHDRAWN,
      note: 'Voluntarily withdrawn by worker',
      changedBy: req.user._id
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
      changedBy: req.user._id
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
