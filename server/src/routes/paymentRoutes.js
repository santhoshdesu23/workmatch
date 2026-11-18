import { Router } from 'express';
import {
  getMyPayments,
  updatePaymentStatus,
  confirmWorkerPaymentReceipt,
  uploadPaymentProofFiles,
  getPaymentProofFile,
  deletePaymentProof
} from '../controllers/paymentsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { handlePaymentProofUpload } from '../middleware/uploadMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// 1. My Payments (Worker or Employer)
router.get('/me', requireAuth, getMyPayments);

// 2. Update Payment Status (supports optional multipart proof files)
router.patch(
  '/:paymentId/status',
  requireAuth,
  requireRole(ROLES.EMPLOYER, ROLES.ADMIN),
  handlePaymentProofUpload('proofs', 3),
  updatePaymentStatus
);

// 3. Dedicated upload payment proof files
router.post(
  '/:paymentId/proofs',
  requireAuth,
  requireRole(ROLES.EMPLOYER, ROLES.ADMIN),
  handlePaymentProofUpload('proofs', 3),
  uploadPaymentProofFiles
);

// 4. View / stream / download payment proof file (Worker, Employer, or Admin)
router.get('/:paymentId/proofs/:fileId', requireAuth, getPaymentProofFile);

// 5. Delete payment proof file (Employer or Admin)
router.delete(
  '/:paymentId/proofs/:fileId',
  requireAuth,
  requireRole(ROLES.EMPLOYER, ROLES.ADMIN),
  deletePaymentProof
);

// 6. Confirm payment receipt (Worker only)
router.post('/:paymentId/confirm-receipt', requireAuth, requireRole(ROLES.WORKER), confirmWorkerPaymentReceipt);

export default router;
