import crypto from 'crypto';
import mongoose from 'mongoose';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { PAYMENT_STATUSES, ROLES } from '../config/constants.js';
import { createNotification } from '../services/notificationService.js';
import {
  storePaymentProof,
  getPaymentProofStream,
  deletePaymentProofFile,
  MAX_PROOFS_PER_PAYMENT
} from '../services/gridfsService.js';

export const VALID_PAYMENT_TRANSITIONS = {
  [PAYMENT_STATUSES.NOT_DUE]: [PAYMENT_STATUSES.DUE, PAYMENT_STATUSES.CANCELLED],
  [PAYMENT_STATUSES.DUE]: [
    PAYMENT_STATUSES.PROCESSING,
    PAYMENT_STATUSES.PAID,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.DISPUTED
  ],
  [PAYMENT_STATUSES.PROCESSING]: [
    PAYMENT_STATUSES.PAID,
    PAYMENT_STATUSES.DUE,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.DISPUTED
  ],
  [PAYMENT_STATUSES.PAID]: [PAYMENT_STATUSES.DISPUTED],
  [PAYMENT_STATUSES.CANCELLED]: [],
  [PAYMENT_STATUSES.DISPUTED]: [
    PAYMENT_STATUSES.PROCESSING,
    PAYMENT_STATUSES.PAID,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.DUE
  ]
};

export const getMyPayments = async (req, res, next) => {
  try {
    const activeRole = req.query.role || req.user.activeRole || req.user.role;
    const isWorker = activeRole === ROLES.WORKER;
    const filter = isWorker ? { worker: req.user._id } : { employer: req.user._id };

    const payments = await PaymentRecord.find(filter)
      .populate('job', 'title workDate totalHours grossPay payBasis locationName')
      .populate('worker', 'name email firstName lastName')
      .populate('employer', 'name email firstName lastName businessName')
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
    const {
      status,
      paymentMethod,
      providerReference,
      note = '',
      verificationSource,
      confirmedDisbursed
    } = req.body;

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
      if (payment.status === status && !req.files?.length) {
        return res.status(200).json({
          success: true,
          message: `Payment is already ${status}.`,
          payment
        });
      }

      const allowedTransitions = VALID_PAYMENT_TRANSITIONS[payment.status] || [];
      if (payment.status !== status && !allowedTransitions.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment status transition from ${payment.status} to ${status}.`
        });
      }
    }

    // Handle any files uploaded concurrently in multipart form data
    const newProofs = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const currentProofsCount = payment.proofs ? payment.proofs.length : 0;
      if (currentProofsCount + req.files.length > MAX_PROOFS_PER_PAYMENT) {
        return res.status(400).json({
          success: false,
          code: 'TOO_MANY_FILES',
          message: `Maximum ${MAX_PROOFS_PER_PAYMENT} payment proof files allowed per payment record. Currently has ${currentProofsCount}.`
        });
      }

      for (const file of req.files) {
        // Prevent duplicate file upload on the same payment record
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const isDuplicate = (payment.proofs || []).some(
          (p) => p.originalName === file.originalname && p.size === file.size
        );
        if (isDuplicate) {
          return res.status(400).json({
            success: false,
            code: 'DUPLICATE_FILE',
            message: `The file "${file.originalname}" has already been uploaded for this payment.`
          });
        }

        let proofDoc;
        try {
          proofDoc = await storePaymentProof({
            fileBuffer: file.buffer,
            originalName: file.originalname,
            declaredMimeType: file.mimetype,
            uploadedBy: req.user._id,
            paymentId: payment._id,
            jobId: payment.job?._id || payment.job
          });
        } catch (proofErr) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_FILE',
            message: proofErr.message
          });
        }
        newProofs.push(proofDoc);
      }
    }

    const totalProofsCount = (payment.proofs ? payment.proofs.length : 0) + newProofs.length;

    // Strict Business Rules when marking as PAID:
    if (status === PAYMENT_STATUSES.PAID) {
      const normalizedMethod = String(paymentMethod || payment.paymentMethod || '').trim().toLowerCase();

      // 1. Check disbursement confirmation acknowledgment
      const isConfirmed =
        confirmedDisbursed === true ||
        confirmedDisbursed === 'true' ||
        payment.status === PAYMENT_STATUSES.PAID;
      if (!isConfirmed && !isAdmin) {
        return res.status(400).json({
          success: false,
          code: 'CONFIRMATION_REQUIRED',
          message: 'You must confirm that the wage payment has actually been disbursed to the worker.'
        });
      }

      // 2. UPI requires transaction reference code and proof attachment
      if (normalizedMethod.includes('upi')) {
        const ref = String(providerReference || payment.providerReference || '').trim();
        if (!ref) {
          return res.status(400).json({
            success: false,
            code: 'TRANSACTION_REF_REQUIRED',
            message: 'UPI payments require a valid Transaction Reference / UTR number.'
          });
        }
        if (totalProofsCount === 0) {
          return res.status(400).json({
            success: false,
            code: 'PAYMENT_PROOF_REQUIRED',
            message: 'Please upload a screenshot or receipt as proof of UPI payment.'
          });
        }
      }

      // 3. Bank Transfer requires transaction reference code and proof attachment
      if (normalizedMethod.includes('bank') || normalizedMethod.includes('transfer') || normalizedMethod.includes('neft') || normalizedMethod.includes('rtgs') || normalizedMethod.includes('imps')) {
        const ref = String(providerReference || payment.providerReference || '').trim();
        if (!ref) {
          return res.status(400).json({
            success: false,
            code: 'TRANSACTION_REF_REQUIRED',
            message: 'Bank transfers require a valid Bank Transaction / UTR reference number.'
          });
        }
        if (totalProofsCount === 0) {
          return res.status(400).json({
            success: false,
            code: 'PAYMENT_PROOF_REQUIRED',
            message: 'Please upload a bank transfer receipt or payment screenshot.'
          });
        }
      }

      // 4. Other requires explanation note
      if (normalizedMethod.includes('other')) {
        const noteStr = String(note || payment.notes || '').trim();
        if (!noteStr || noteStr.length < 5) {
          return res.status(400).json({
            success: false,
            code: 'NOTE_REQUIRED',
            message: 'Please provide explanatory notes for payment method "Other".'
          });
        }
      }
    }

    // Determine verification source
    let targetVerificationSource = payment.verificationSource;
    if (verificationSource === 'provider_verified' && isAdmin) {
      targetVerificationSource = 'provider_verified';
    } else if (payment.workerConfirmedReceipt) {
      targetVerificationSource = 'worker_confirmed';
    } else {
      targetVerificationSource = 'employer_recorded';
    }

    const updateOperations = {
      $set: {
        status,
        ...(paymentMethod ? { paymentMethod: String(paymentMethod).slice(0, 100) } : {}),
        ...(providerReference ? { providerReference: String(providerReference).slice(0, 150) } : {}),
        ...(note !== undefined ? { notes: String(note).slice(0, 500) } : {}),
        verificationSource: targetVerificationSource
      },
      $push: {
        history: {
          status,
          note: String(note || (newProofs.length ? `Added ${newProofs.length} payment proof(s).` : '')).slice(0, 500),
          updatedBy: req.user._id,
          timestamp: new Date()
        }
      }
    };

    if (newProofs.length > 0) {
      updateOperations.$push.proofs = { $each: newProofs };
    }

    // Atomic update
    const updatedPayment = await PaymentRecord.findByIdAndUpdate(paymentId, updateOperations, {
      new: true
    })
      .populate('job')
      .populate('worker', 'name email')
      .populate('employer', 'name email');

    // Notify worker about payment status change
    if (updatedPayment && status !== payment.status) {
      await createNotification({
        recipient: updatedPayment.worker._id || updatedPayment.worker,
        type: 'PAYMENT_UPDATE',
        title: `Payment Update: ₹${updatedPayment.amount} (${status})`,
        message: `The payment status for "${updatedPayment.job?.title || 'your shift'}" was marked as ${status}. Method: ${updatedPayment.paymentMethod}.`,
        link: '/worker/payments'
      });
    }

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}.`,
      payment: updatedPayment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dedicated endpoint to upload proof screenshots/receipts for a payment record.
 * POST /api/payments/:paymentId/proofs
 */
export const uploadPaymentProofFiles = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const payment = await PaymentRecord.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // IDOR check: Employer of the job or Admin
    const isEmployer = payment.employer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    if (!isEmployer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Only the paying employer or admin can upload payment proof.' });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No payment proof files were provided.' });
    }

    const currentCount = payment.proofs ? payment.proofs.length : 0;
    if (currentCount + req.files.length > MAX_PROOFS_PER_PAYMENT) {
      return res.status(400).json({
        success: false,
        code: 'TOO_MANY_FILES',
        message: `A payment record can have at most ${MAX_PROOFS_PER_PAYMENT} evidence files. Currently has ${currentCount}.`
      });
    }

    const storedProofs = [];
    for (const file of req.files) {
      // Check duplicate
      const isDuplicate = (payment.proofs || []).some(
        (p) => p.originalName === file.originalname && p.size === file.size
      );
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          code: 'DUPLICATE_FILE',
          message: `The file "${file.originalname}" has already been uploaded for this payment.`
        });
      }

      let proof;
      try {
        proof = await storePaymentProof({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          declaredMimeType: file.mimetype,
          uploadedBy: req.user._id,
          paymentId: payment._id,
          jobId: payment.job
        });
      } catch (storeErr) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_FILE',
          message: storeErr.message
        });
      }
      storedProofs.push(proof);
    }

    payment.proofs = payment.proofs || [];
    payment.proofs.push(...storedProofs);
    payment.history.push({
      status: payment.status,
      note: `Uploaded ${storedProofs.length} payment proof attachment(s).`,
      updatedBy: req.user._id,
      timestamp: new Date()
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: `Uploaded ${storedProofs.length} payment proof(s) successfully.`,
      proofs: payment.proofs,
      payment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream payment proof file securely from MongoDB GridFS.
 * GET /api/payments/:paymentId/proofs/:fileId
 */
export const getPaymentProofFile = async (req, res, next) => {
  try {
    const { paymentId, fileId } = req.params;
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    const payment = await PaymentRecord.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // Role-based IDOR validation:
    // Only the paying employer, the receiving worker, or an administrator can access payment evidence
    const isEmployer = payment.employer.toString() === req.user._id.toString();
    const isWorker = payment.worker.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isEmployer && !isWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to inspect this payment evidence.'
      });
    }

    const proofMetadata = (payment.proofs || []).find(
      (p) => p.fileId.toString() === fileId || p._id?.toString() === fileId
    );
    if (!proofMetadata) {
      return res.status(404).json({ success: false, message: 'Payment proof file not found on this record.' });
    }

    const actualFileId = proofMetadata.fileId;
    const streamResult = await getPaymentProofStream(actualFileId);
    if (!streamResult) {
      return res.status(404).json({ success: false, message: 'Evidence file not found in storage bucket.' });
    }

    const { fileDoc, downloadStream } = streamResult;

    // Secure response headers
    res.setHeader('Content-Type', fileDoc.contentType || proofMetadata.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', fileDoc.length || proofMetadata.size);
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const disposition = isDownload ? 'attachment' : 'inline';
    const safeFilename = encodeURIComponent(proofMetadata.originalName || fileDoc.filename);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}"`);

    downloadStream.on('error', (streamErr) => {
      console.warn('[GridFS Stream Error]:', streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream evidence file.' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a payment proof attachment from a payment record.
 * DELETE /api/payments/:paymentId/proofs/:fileId
 */
export const deletePaymentProof = async (req, res, next) => {
  try {
    const { paymentId, fileId } = req.params;

    const payment = await PaymentRecord.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // Only the employer or admin can delete proofs
    const isEmployer = payment.employer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    if (!isEmployer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Workers cannot delete employer payment evidence.'
      });
    }

    const proofIndex = (payment.proofs || []).findIndex(
      (p) => p.fileId.toString() === fileId || p._id?.toString() === fileId
    );
    if (proofIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment proof file not found.' });
    }

    const targetProof = payment.proofs[proofIndex];

    // Remove from GridFS bucket
    await deletePaymentProofFile(targetProof.fileId);

    // Remove from array
    payment.proofs.splice(proofIndex, 1);
    payment.history.push({
      status: payment.status,
      note: `Removed payment proof: ${targetProof.originalName}`,
      updatedBy: req.user._id,
      timestamp: new Date()
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment proof removed successfully.',
      proofs: payment.proofs
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

    // Atomic conditional update
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
      title: `Worker confirmed payment receipt: ₹${updatedPayment.amount}`,
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

/**
 * Admin: Search and filter platform payment records.
 * GET /api/admin/payments
 */
export const getAdminPayments = async (req, res, next) => {
  try {
    const {
      status,
      search,
      hasProof,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    if (status && Object.values(PAYMENT_STATUSES).includes(status)) {
      filter.status = status;
    }

    if (hasProof === 'true') {
      filter['proofs.0'] = { $exists: true };
    } else if (hasProof === 'false') {
      filter.$or = [{ proofs: { $exists: false } }, { proofs: { $size: 0 } }];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Search query
    let queryFilter = filter;
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      queryFilter = {
        ...filter,
        $or: [
          { providerReference: regex },
          { paymentMethod: regex },
          { notes: regex }
        ]
      };
    }

    const [payments, total] = await Promise.all([
      PaymentRecord.find(queryFilter)
        .populate('job', 'title workDate locationName grossPay payBasis')
        .populate('worker', 'name email firstName lastName')
        .populate('employer', 'name email firstName lastName businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PaymentRecord.countDocuments(queryFilter)
    ]);

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};
