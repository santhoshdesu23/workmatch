import { Router } from 'express';
import {
  checkInWorkerGPS,
  getMyAttendanceHistory,
  getWorkerJobAttendanceStatus,
  getEmployerAttendanceOverview,
  getJobAttendanceDetail,
  markWorkerManualAttendance,
  correctAttendanceRecord,
  getAttendanceAuditHistory
} from '../controllers/attendanceController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// All attendance routes require valid authentication
router.use(requireAuth);

// Worker routes
router.post('/check-in', requireRole(ROLES.WORKER), checkInWorkerGPS);
router.get('/my-history', requireRole(ROLES.WORKER), getMyAttendanceHistory);
router.get('/job/:jobId/my-status', requireRole(ROLES.WORKER), getWorkerJobAttendanceStatus);

// Employer routes
router.get('/employer/jobs', requireRole(ROLES.EMPLOYER, ROLES.ADMIN), getEmployerAttendanceOverview);
router.get('/job/:jobId', requireRole(ROLES.EMPLOYER, ROLES.ADMIN), getJobAttendanceDetail);
router.post('/job/:jobId/worker/:workerId/manual', requireRole(ROLES.EMPLOYER, ROLES.ADMIN), markWorkerManualAttendance);
router.patch('/:attendanceId/correction', requireRole(ROLES.EMPLOYER, ROLES.ADMIN), correctAttendanceRecord);

// Audit history (accessible to worker, employer, or admin)
router.get('/:attendanceId/audit', getAttendanceAuditHistory);

export default router;
