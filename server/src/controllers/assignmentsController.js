import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { ASSIGNMENT_STATUSES, PAYMENT_STATUSES, APPLICATION_STATUSES, JOB_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';

export const getMyAssignments = async (req, res, next) => {
  try {
    const isWorker = req.user.role === ROLES.WORKER;
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

    const enriched = assignments.map((a) => ({
      ...a,
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

    // Handle transition to CANCELLED
    if (status === ASSIGNMENT_STATUSES.CANCELLED) {
      assignment.status = ASSIGNMENT_STATUSES.CANCELLED;
      assignment.cancellationReason = notes || 'Cancelled by employer';
      assignment.cancelledBy = req.user._id;
      if (notes) assignment.attendance.notes = notes;
      await assignment.save();

      // Decrement job filledCount and reopen job if filled
      await Job.findByIdAndUpdate(assignment.job, {
        $inc: { filledCount: -1 },
        $set: { status: JOB_STATUSES.OPEN }
      });

      // Cancel associated payment record if DUE
      await PaymentRecord.findOneAndUpdate(
        { assignment: assignment._id, status: PAYMENT_STATUSES.DUE },
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
      if (assignment.application) {
        await Application.findByIdAndUpdate(assignment.application, {
          $set: { status: APPLICATION_STATUSES.CANCELLED }
        });
      }

      await createNotification({
        recipient: assignment.worker,
        type: 'APPLICATION_STATUS',
        title: 'Assignment Cancelled',
        message: `Your shift assignment has been cancelled by the employer. Reason: "${notes || 'None provided'}".`,
        link: '/worker/assignments'
      });

      return res.status(200).json({
        success: true,
        message: 'Assignment cancelled and job capacity restored.',
        assignment
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
        message: `Employer confirmed your completion for "${assignment.job.title}". Payment status has been updated.`,
        link: '/worker/assignments'
      });
    }

    // If both confirmed (or employer confirms completion), update assignment to COMPLETED
    if (
      (assignment.completionConfirmations.workerConfirmed &&
        assignment.completionConfirmations.employerConfirmed) ||
      isEmployer
    ) {
      assignment.status = ASSIGNMENT_STATUSES.COMPLETED;

      // Update payment status to DUE or PROCESSING
      await PaymentRecord.findOneAndUpdate(
        { assignment: assignment._id },
        {
          $set: { status: PAYMENT_STATUSES.PROCESSING },
          $push: {
            history: {
              status: PAYMENT_STATUSES.PROCESSING,
              note: 'Shift confirmed completed. Payment processing triggered.',
              updatedBy: req.user._id,
              timestamp: now
            }
          }
        }
      );

      // Increment worker's completed jobs count
      await WorkerProfile.findOneAndUpdate(
        { user: assignment.worker },
        { $inc: { completedJobsCount: 1 } }
      );
    }

    await assignment.save();

    res.status(200).json({
      success: true,
      message: 'Completion status recorded successfully.',
      assignment
    });
  } catch (error) {
    next(error);
  }
};
