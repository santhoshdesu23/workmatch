import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { ASSIGNMENT_STATUSES, PAYMENT_STATUSES, APPLICATION_STATUSES, JOB_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';
import { isJobWorkEnded, isJobWorkOngoing, isJobApplicationDeadlinePassed } from '../utils/scheduleUtils.js';

export const getMyAssignments = async (req, res, next) => {
  try {
    const activeRole = req.query.role || req.user.activeRole || req.user.role;
    const isWorker = activeRole === ROLES.WORKER;
    const filter = isWorker ? { worker: req.user._id } : { employer: req.user._id };

    const assignments = await Assignment.find(filter)
      .populate('job')
      .populate('worker', 'name email verificationStatus')
      .populate('employer', 'name email')
      .sort({ 'agreedSchedule.workDate': -1 })
      .lean();

    // Attach payment info
    const assignmentIds = assignments.map((a) => a._id);
    const payments = await PaymentRecord.find({ assignment: { $in: assignmentIds } }).lean();
    const paymentMap = new Map();
    payments.forEach((p) => paymentMap.set(p.assignment.toString(), p));

    const now = new Date();
    const enriched = assignments.map((a) => ({
      ...a,
      isWorkEnded: isJobWorkEnded(a.agreedSchedule || a.job, now),
      isWorkOngoing: isJobWorkOngoing(a.agreedSchedule || a.job, now),
      payment: paymentMap.get(a._id.toString()) || null
    }));

    res.status(200).json({
      success: true,
      assignments: enriched
    });
  } catch (error) {
    next(error);
  }
};

export const updateAssignmentStatus = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { status, notes } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (
      assignment.employer.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // If only notes are provided without status change
    if (!status && notes !== undefined) {
      assignment.attendance.notes = notes;
      await assignment.save();
      return res.status(200).json({
        success: true,
        message: 'Assignment attendance notes updated.',
        assignment
      });
    }

    // Validate target status
    if (!status || !Object.values(ASSIGNMENT_STATUSES).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid assignment status: "${status}".`
      });
    }

    // Disallow setting COMPLETED directly via status patch; must use /confirm-completion
    if (status === ASSIGNMENT_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Completion must be recorded through the /confirm-completion endpoint to ensure completion confirmations, payment processing, and worker metrics are synchronized.'
      });
    }

    // State invariant checks
    if (assignment.status === ASSIGNMENT_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify the status of an already completed assignment.'
      });
    }

    if (assignment.status === ASSIGNMENT_STATUSES.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify the status of a cancelled assignment.'
      });
    }

    // Handle transition to CANCELLED atomically
    if (status === ASSIGNMENT_STATUSES.CANCELLED) {
      // Must be atomic to prevent race conditions on duplicate concurrent cancellations
      const cancelledAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignmentId,
          status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] }
        },
        {
          $set: {
            status: ASSIGNMENT_STATUSES.CANCELLED,
            cancellationReason: notes || 'Cancelled by employer',
            cancelledBy: req.user._id,
            ...(notes ? { 'attendance.notes': notes } : {})
          }
        },
        { new: true }
      );

      if (!cancelledAssignment) {
        const latest = await Assignment.findById(assignmentId);
        if (latest?.status === ASSIGNMENT_STATUSES.COMPLETED) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify the status of an already completed assignment.'
          });
        }
        if (latest?.status === ASSIGNMENT_STATUSES.CANCELLED) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify the status of a cancelled assignment.'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Cannot cancel assignment in current status: ${latest?.status || 'unknown'}.`
        });
      }

      // Conditional decrement: only decrement filledCount if filledCount > 0
      const updatedJob = await Job.findOneAndUpdate(
        { _id: cancelledAssignment.job, filledCount: { $gt: 0 } },
        { $inc: { filledCount: -1 } },
        { new: true }
      );

      // Only reopen if the job was FILLED and not CANCELLED/COMPLETED and work hasn't ended and deadline hasn't passed
      if (updatedJob && updatedJob.status === JOB_STATUSES.FILLED && updatedJob.filledCount < updatedJob.openings) {
        if (!isJobWorkEnded(updatedJob) && !isJobApplicationDeadlinePassed(updatedJob)) {
          await Job.findOneAndUpdate(
            { _id: updatedJob._id, status: JOB_STATUSES.FILLED },
            { $set: { status: JOB_STATUSES.OPEN } }
          );
        }
      }

      // Cancel associated payment record if NOT already PAID
      await PaymentRecord.findOneAndUpdate(
        { assignment: cancelledAssignment._id, status: { $in: [PAYMENT_STATUSES.NOT_DUE, PAYMENT_STATUSES.DUE, PAYMENT_STATUSES.PROCESSING] } },
        {
          $set: { status: PAYMENT_STATUSES.CANCELLED },
          $push: {
            history: {
              status: PAYMENT_STATUSES.CANCELLED,
              note: 'Assignment cancelled by employer.',
              updatedBy: req.user._id,
              timestamp: new Date()
            }
          }
        }
      );

      // Cancel underlying application
      if (cancelledAssignment.application) {
        await Application.findByIdAndUpdate(cancelledAssignment.application, {
          $set: { status: APPLICATION_STATUSES.CANCELLED }
        });
      }

      await createNotification({
        recipient: cancelledAssignment.worker,
        type: 'APPLICATION_STATUS',
        title: 'Assignment Cancelled',
        message: `Your shift assignment has been cancelled by the employer. Reason: "${notes || 'None provided'}".`,
        link: '/worker/assignments'
      });

      return res.status(200).json({
        success: true,
        message: 'Assignment cancelled and job capacity restored.',
        assignment: cancelledAssignment
      });
    }

    // Valid transitions from CONFIRMED
    if (assignment.status === ASSIGNMENT_STATUSES.CONFIRMED) {
      if (status !== ASSIGNMENT_STATUSES.IN_PROGRESS && status !== ASSIGNMENT_STATUSES.NO_SHOW) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from CONFIRMED to ${status}. Allowed: IN_PROGRESS, CANCELLED, NO_SHOW.`
        });
      }
    } else if (assignment.status === ASSIGNMENT_STATUSES.IN_PROGRESS) {
      if (status !== ASSIGNMENT_STATUSES.NO_SHOW) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from IN_PROGRESS to ${status}. Allowed: CANCELLED, NO_SHOW (or COMPLETED via confirm-completion).`
        });
      }
    }

    assignment.status = status;
    if (notes) {
      assignment.attendance.notes = notes;
    }
    await assignment.save();

    res.status(200).json({
      success: true,
      message: `Assignment status updated to ${status}.`,
      assignment
    });
  } catch (error) {
    next(error);
  }
};

export const confirmCompletion = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId).populate('job');
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const isWorker = assignment.worker.toString() === req.user._id.toString();
    const isEmployer = assignment.employer.toString() === req.user._id.toString();

    if (!isWorker && !isEmployer && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Guard against confirming completion on cancelled jobs or assignments
    if (assignment.status === ASSIGNMENT_STATUSES.CANCELLED || assignment.job?.status === JOB_STATUSES.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm completion for a cancelled shift or job.'
      });
    }

    if (assignment.status === ASSIGNMENT_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Shift is already marked as completed.'
      });
    }

    if (isWorker && assignment.completionConfirmations?.workerConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'You have already confirmed completion for this shift.'
      });
    }

    if (isEmployer && assignment.completionConfirmations?.employerConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'You have already confirmed completion for this shift.'
      });
    }

    const now = new Date();
    if (!assignment.completionConfirmations) {
      assignment.completionConfirmations = {};
    }

    if (isWorker) {
      assignment.completionConfirmations.workerConfirmed = true;
      assignment.completionConfirmations.workerConfirmedAt = now;
      await createNotification({
        recipient: assignment.employer,
        type: 'COMPLETION_REQUEST',
        title: 'Worker confirmed shift completion',
        message: `${req.user.name} has confirmed completing their shift for "${assignment.job.title}". Please confirm attendance and release payment.`,
        link: '/employer/assignments'
      });
    }

    if (isEmployer) {
      assignment.completionConfirmations.employerConfirmed = true;
      assignment.completionConfirmations.employerConfirmedAt = now;
      await createNotification({
        recipient: assignment.worker,
        type: 'COMPLETION_REQUEST',
        title: 'Employer confirmed shift completion',
        message: `Employer confirmed your completion for "${assignment.job.title}". Awaiting dual confirmation to finalize shift completion.`,
        link: '/worker/assignments'
      });
    }

    if (req.user.role === ROLES.ADMIN && !isWorker && !isEmployer) {
      assignment.completionConfirmations.workerConfirmed = true;
      assignment.completionConfirmations.workerConfirmedAt = now;
      assignment.completionConfirmations.employerConfirmed = true;
      assignment.completionConfirmations.employerConfirmedAt = now;
    }

    // Dual-confirmation enforcement: both worker AND employer must confirm (or admin override)
    const dualConfirmed = Boolean(
      assignment.completionConfirmations.workerConfirmed &&
      assignment.completionConfirmations.employerConfirmed
    );
    const shouldComplete = dualConfirmed || req.user.role === ROLES.ADMIN;

    let updatedAssignment;
    if (shouldComplete) {
      // Atomic transition to COMPLETED guarded by status != COMPLETED to ensure exactly-once execution
      updatedAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignmentId,
          status: { $ne: ASSIGNMENT_STATUSES.COMPLETED }
        },
        {
          $set: {
            status: ASSIGNMENT_STATUSES.COMPLETED,
            'completionConfirmations.workerConfirmed': assignment.completionConfirmations.workerConfirmed,
            'completionConfirmations.workerConfirmedAt': assignment.completionConfirmations.workerConfirmedAt,
            'completionConfirmations.employerConfirmed': assignment.completionConfirmations.employerConfirmed,
            'completionConfirmations.employerConfirmedAt': assignment.completionConfirmations.employerConfirmedAt
          }
        },
        { new: true }
      ).populate('job');

      if (updatedAssignment) {
        // Shift successfully marked COMPLETED for the first time: trigger payment & metrics exactly once
        await PaymentRecord.findOneAndUpdate(
          { assignment: assignment._id },
          {
            $set: { status: PAYMENT_STATUSES.PROCESSING },
            $push: {
              history: {
                status: PAYMENT_STATUSES.PROCESSING,
                note: 'Shift dual-confirmed completed. Payment processing triggered.',
                updatedBy: req.user._id,
                timestamp: now
              }
            }
          }
        );

        await WorkerProfile.findOneAndUpdate(
          { user: assignment.worker },
          { $inc: { completedJobsCount: 1 } }
        );
      } else {
        // Already marked completed concurrently
        updatedAssignment = await Assignment.findById(assignmentId).populate('job');
      }
    } else {
      // Only one party has confirmed so far; save confirmation without marking shift completed
      updatedAssignment = await Assignment.findByIdAndUpdate(
        assignmentId,
        {
          $set: {
            'completionConfirmations.workerConfirmed': assignment.completionConfirmations.workerConfirmed,
            'completionConfirmations.workerConfirmedAt': assignment.completionConfirmations.workerConfirmedAt,
            'completionConfirmations.employerConfirmed': assignment.completionConfirmations.employerConfirmed,
            'completionConfirmations.employerConfirmedAt': assignment.completionConfirmations.employerConfirmedAt
          }
        },
        { new: true }
      ).populate('job');
    }

    res.status(200).json({
      success: true,
      message: shouldComplete
        ? 'Dual confirmation verified. Shift marked as completed.'
        : 'Completion confirmation recorded. Awaiting confirmation from the other party.',
      assignment: updatedAssignment || assignment
    });
  } catch (error) {
    next(error);
  }
};
