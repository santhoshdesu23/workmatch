import { PaymentRecord } from '../models/PaymentRecord.js';
import { PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';

export const VALID_PAYMENT_TRANSITIONS = {
  [PAYMENT_STATUSES.NOT_DUE]: [PAYMENT_STATUSES.DUE, PAYMENT_STATUSES.CANCELLED],
  [PAYMENT_STATUSES.DUE]: [PAYMENT_STATUSES.PROCESSING, PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.CANCELLED, PAYMENT_STATUSES.DISPUTED],
  [PAYMENT_STATUSES.PROCESSING]: [PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.DUE, PAYMENT_STATUSES.CANCELLED, PAYMENT_STATUSES.DISPUTED],
  [PAYMENT_STATUSES.PAID]: [PAYMENT_STATUSES.DISPUTED],
  [PAYMENT_STATUSES.CANCELLED]: [],
  [PAYMENT_STATUSES.DISPUTED]: [PAYMENT_STATUSES.PROCESSING, PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.CANCELLED, PAYMENT_STATUSES.DUE]
};

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
    const { status, paymentMethod, providerReference, note = '', verificationSource } = req.body;

    const payment = await PaymentRecord.findById(paymentId).populate('job');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // Role-based authorization & IDOR check
    const isEmployer = payment.employer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    if (!isEmployer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this payment record.' });
    }

    if (!Object.values(PAYMENT_STATUSES).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid payment status: ${status}.` });
    }

    // Prevent client from spoofing provider_verified without real trusted payment provider integration
    if (verificationSource === 'provider_verified' && !isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'provider_verified is reserved for automated trusted payment provider integrations.'
      });
    }

    // Validate state transitions
    if (!isAdmin) {
      if (payment.status === status) {
        return res.status(200).json({
          success: true,
          message: `Payment is already ${status}.`,
          payment
        });
      }

      const allowedTransitions = VALID_PAYMENT_TRANSITIONS[payment.status] || [];
      if (!allowedTransitions.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment status transition from ${payment.status} to ${status}.`
        });
      }
    }

    // Determine verification source preserving dual-attestation ledger behavior
    let targetVerificationSource = payment.verificationSource;
    if (verificationSource === 'provider_verified' && isAdmin) {
      targetVerificationSource = 'provider_verified';
    } else if (payment.workerConfirmedReceipt) {
      targetVerificationSource = 'worker_confirmed';
    } else {
      targetVerificationSource = 'employer_recorded';
    }

    // Atomic conditional update to guard against concurrent status overwrites
    const updatedPayment = await PaymentRecord.findOneAndUpdate(
      {
        _id: paymentId,
        status: payment.status
      },
      {
        $set: {
          status,
          ...(paymentMethod ? { paymentMethod: String(paymentMethod).slice(0, 100) } : {}),
          ...(providerReference ? { providerReference: String(providerReference).slice(0, 150) } : {}),
          verificationSource: targetVerificationSource
        },
        $push: {
          history: {
            status,
            note: String(note || '').slice(0, 500),
            updatedBy: req.user._id,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    ).populate('job');

    if (!updatedPayment) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Payment status was modified concurrently by another process.'
      });
    }

    // Notify worker about payment status change
    await createNotification({
      recipient: updatedPayment.worker,
      type: 'PAYMENT_UPDATE',
      title: `Payment Update: $${updatedPayment.amount} (${status})`,
      message: `The payment status for "${updatedPayment.job?.title || 'your shift'}" was marked as ${status}. Method: ${updatedPayment.paymentMethod}.`,
      link: '/worker/payments'
    });

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}.`,
      payment: updatedPayment
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

    // Receipt cannot be confirmed if payment is not marked PAID
    if (payment.status !== PAYMENT_STATUSES.PAID) {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm receipt for payment in status ${payment.status}. Payment must be marked PAID first.`
      });
    }

    // Reject repeated receipt confirmation
    if (payment.workerConfirmedReceipt) {
      return res.status(400).json({
        success: false,
        message: 'Worker payment receipt has already been confirmed.'
      });
    }

    // Atomic conditional update to prevent concurrent duplicate receipt confirmations
    const updatedPayment = await PaymentRecord.findOneAndUpdate(
      {
        _id: paymentId,
        worker: req.user._id,
        workerConfirmedReceipt: { $ne: true },
        status: PAYMENT_STATUSES.PAID
      },
      {
        $set: {
          workerConfirmedReceipt: true,
          workerConfirmedReceiptAt: new Date(),
          verificationSource: 'worker_confirmed'
        },
        $push: {
          history: {
            status: payment.status,
            note: 'Worker confirmed funds receipt.',
            updatedBy: req.user._id,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    ).populate('job');

    if (!updatedPayment) {
      const current = await PaymentRecord.findById(paymentId);
      if (current?.workerConfirmedReceipt) {
        return res.status(400).json({
          success: false,
          message: 'Worker payment receipt has already been confirmed.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm payment receipt in current state.'
      });
    }

    // Notify employer that worker confirmed receipt
    await createNotification({
      recipient: updatedPayment.employer,
      type: 'PAYMENT_UPDATE',
      title: `Worker confirmed payment receipt: $${updatedPayment.amount}`,
      message: `${req.user.name} confirmed receiving payment for "${updatedPayment.job?.title || 'the shift'}".`,
      link: '/employer/assignments'
    });

    res.status(200).json({
      success: true,
      message: 'Payment receipt confirmed successfully.',
      payment: updatedPayment
    });
  } catch (error) {
    next(error);
  }
};
