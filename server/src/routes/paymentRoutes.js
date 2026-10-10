import { Router } from 'express';
import {
  getMyPayments,
  updatePaymentStatus
} from '../controllers/paymentsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/me', requireAuth, getMyPayments);
router.patch('/:paymentId/status', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), updatePaymentStatus);

export default router;
