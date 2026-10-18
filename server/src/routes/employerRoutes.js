import { Router } from 'express';
import {
  getMyEmployerProfile,
  updateMyEmployerProfile,
  getEmployerJobs,
  getEmployerDashboard,
  getEmployerReliabilityHandler
} from '../controllers/employersController.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/me', requireAuth, requireRole(ROLES.EMPLOYER), getMyEmployerProfile);
router.patch('/me', requireAuth, requireRole(ROLES.EMPLOYER), updateMyEmployerProfile);
router.get('/me/jobs', requireAuth, requireRole(ROLES.EMPLOYER), getEmployerJobs);
router.get('/me/dashboard', requireAuth, requireRole(ROLES.EMPLOYER), getEmployerDashboard);
router.get('/:employerId/reliability', optionalAuth, getEmployerReliabilityHandler);

export default router;
