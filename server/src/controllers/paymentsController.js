import { PaymentRecord } from '../models/PaymentRecord.js';
import { PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';

export const getMyPayments = async (req, res, next) => {
  try {
    const isWorker = req.user.role === ROLES.WORKER;
    const filter = isWorker ? { worker: req.user._id } : { employer: req.user._id };

    const payments = await PaymentRecord.find(filter)
      .populate('job', 'title workDate totalHours')
      .populate('worker', 'name email')
      .populate('employer', 'name email')
      .populate('assignment')
      .sort({ createdAt: -1 })
      .lean();

    const summary = {
      totalPaid: 0,
      totalPending: 0,
      countPaid: 0,
      countPending: 0
    };

    payments.forEach((p) => {
      if (p.status === PAYMENT_STATUSES.PAID) {
        summary.totalPaid += p.amount;
        summary.countPaid++;
      } else if (p.status === PAYMENT_STATUSES.DUE || p.status === PAYMENT_STATUSES.PROCESSING) {
        summary.totalPending += p.amount;
        summary.countPending++;
      }
    });

    res.status(200).json({
      success: true,
      payments,
      summary
    });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { status, paymentMethod, providerReference, note = '' } = req.body;

    const payment = await PaymentRecord.findById(paymentId).populate('job');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (
      payment.employer.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (!Object.values(PAYMENT_STATUSES).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status.' });
    }

    payment.status = status;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (providerReference) payment.providerReference = providerReference;

    payment.history.push({
      status,
      note,
      updatedBy: req.user._id,
      timestamp: new Date()
    });

    await payment.save();

    // Notify worker about payment status change
    await createNotification({
      recipient: payment.worker,
      type: 'PAYMENT_UPDATE',
      title: `Payment Update: $${payment.amount} ${status}`,
      message: `The payment status for "${payment.job.title}" has been updated to ${status}. Method: ${payment.paymentMethod}.`,
      link: '/worker/payments'
    });

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}.`,
      payment
    });
  } catch (error) {
    next(error);
  }
};
