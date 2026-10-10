import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminUsers,
  updateAdminUserStatus,
  getAdminJobs,
  getAdminReports,
  resolveAdminReport,
  getAdminVerifications,
  reviewAdminVerification
} from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Server-enforced administrator authorization
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/dashboard', getAdminDashboard);
router.get('/users', getAdminUsers);
router.patch('/users/:userId/status', updateAdminUserStatus);
router.get('/jobs', getAdminJobs);
router.get('/reports', getAdminReports);
router.patch('/reports/:reportId', resolveAdminReport);
router.get('/verifications', getAdminVerifications);
router.patch('/verifications/:verificationId', reviewAdminVerification);

export default router;
