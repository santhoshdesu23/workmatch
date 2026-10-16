import { PaymentRecord } from '../models/PaymentRecord.js';
import { PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';

export const getMyPayments = async (req, res, next) => {
  try {
    const isWorker = req.user.role === ROLES.WORKER;
    const filter = isWorker ? { worker: req.user._id } : { employer: req.user._id };

    const payments = await PaymentRecord.find(filter)
      .populate('job', 'title workDate totalHours grossPay')
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

    // Role-based authorization & IDOR check
    if (
      payment.employer.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this payment record.' });
    }

    if (!Object.values(PAYMENT_STATUSES).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid payment status: ${status}.` });
    }

    payment.status = status;
    if (paymentMethod) payment.paymentMethod = String(paymentMethod).slice(0, 100);
    if (providerReference) payment.providerReference = String(providerReference).slice(0, 150);

    // Honestly distinguish employer recorded payment from provider verified
    if (!payment.workerConfirmedReceipt) {
      payment.verificationSource = 'employer_recorded';
    }

    payment.history.push({
      status,
      note: String(note || '').slice(0, 500),
      updatedBy: req.user._id,
      timestamp: new Date()
    });

    await payment.save();

    // Notify worker about payment status change
    await createNotification({
      recipient: payment.worker,
      type: 'PAYMENT_UPDATE',
      title: `Payment Update: $${payment.amount} (${status})`,
      message: `The payment status for "${payment.job.title}" was marked as ${status}. Method: ${payment.paymentMethod}.`,
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

export const confirmWorkerPaymentReceipt = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const payment = await PaymentRecord.findById(paymentId).populate('job');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // IDOR enforcement: Only the assigned worker can confirm receipt
    if (payment.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Only the payee can confirm payment receipt.' });
    }

    payment.workerConfirmedReceipt = true;
    payment.workerConfirmedReceiptAt = new Date();
    payment.verificationSource = 'worker_confirmed';

    payment.history.push({
      status: payment.status,
      note: 'Worker confirmed funds receipt.',
      updatedBy: req.user._id,
      timestamp: new Date()
    });

    await payment.save();

    // Notify employer that worker confirmed receipt
    await createNotification({
      recipient: payment.employer,
      type: 'PAYMENT_UPDATE',
      title: `Worker confirmed payment receipt: $${payment.amount}`,
      message: `${req.user.name} confirmed receiving payment for "${payment.job.title}".`,
      link: '/employer/assignments'
    });

    res.status(200).json({
      success: true,
      message: 'Payment receipt confirmed successfully.',
      payment
    });
  } catch (error) {
    next(error);
  }
};
