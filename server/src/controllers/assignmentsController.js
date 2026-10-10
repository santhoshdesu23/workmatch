import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { Job } from '../models/Job.js';
import { ASSIGNMENT_STATUSES, PAYMENT_STATUSES, ROLES } from '../config/constants.js';
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
