import { Router } from 'express';
import {
  getMyApplications,
  updateApplicationStatus,
  withdrawApplication,
  respondToOffer,
  reconfirmInterest
} from '../controllers/applicationsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/me', requireAuth, requireRole(ROLES.WORKER), getMyApplications);
router.patch('/:applicationId/status', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), updateApplicationStatus);
router.post('/:applicationId/withdraw', requireAuth, requireRole(ROLES.WORKER), withdrawApplication);
router.post('/:applicationId/respond-to-offer', requireAuth, requireRole(ROLES.WORKER), respondToOffer);
router.post('/:applicationId/reconfirm', requireAuth, requireRole(ROLES.WORKER), reconfirmInterest);

export default router;
