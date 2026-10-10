import { Router } from 'express';
import {
  getMyWorkerProfile,
  updateMyWorkerProfile,
  updateAvailability,
  getSavedJobs
} from '../controllers/workersController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/me', requireAuth, requireRole(ROLES.WORKER), getMyWorkerProfile);
router.patch('/me', requireAuth, requireRole(ROLES.WORKER), updateMyWorkerProfile);
router.patch('/me/availability', requireAuth, requireRole(ROLES.WORKER), updateAvailability);
router.get('/me/saved-jobs', requireAuth, requireRole(ROLES.WORKER), getSavedJobs);

export default router;
