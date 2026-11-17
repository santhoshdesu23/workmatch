import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserStatus,
  getAdminWorkers,
  getAdminEmployers,
  getAdminJobs,
  getAdminJobDetails,
  updateAdminJobStatus,
  getAdminApplications,
  getAdminRecruitmentAnalytics,
  getAdminAttendance,
  correctAdminAttendance,
  getAdminVerifications,
  reviewAdminVerification,
  getAdminReports,
  getAdminReportDetails,
  resolveAdminReport,
  getAdminAnalytics,
  exportAdminCSV,
  getAdminAuditLogs,
  getAdminSettings,
  updateAdminSetting
} from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Server-enforced administrator authorization for every admin route
router.use(requireAuth, requireRole(ROLES.ADMIN));

// 1. Dashboard & Overview
router.get('/dashboard', getAdminDashboard);

// 2. User Management
router.get('/users', getAdminUsers);
router.get('/users/:userId', getAdminUserDetails);
router.patch('/users/:userId/status', updateAdminUserStatus);
router.get('/workers', getAdminWorkers);
router.get('/employers', getAdminEmployers);

// 3. Job Management & Moderation
router.get('/jobs', getAdminJobs);
router.get('/jobs/:jobId', getAdminJobDetails);
router.patch('/jobs/:jobId/status', updateAdminJobStatus);

// 4. Applications & Recruitment Monitoring
router.get('/applications', getAdminApplications);
router.get('/recruitment/analytics', getAdminRecruitmentAnalytics);

// 5. Attendance Monitoring
router.get('/attendance', getAdminAttendance);
router.patch('/attendance/:attendanceId/correct', correctAdminAttendance);

// 6. Verification Management
router.get('/verifications', getAdminVerifications);
router.patch('/verifications/:verificationId', reviewAdminVerification);

// 7. Reports & Complaints (Trust & Safety)
router.get('/reports', getAdminReports);
router.get('/reports/:reportId', getAdminReportDetails);
router.patch('/reports/:reportId', resolveAdminReport);

// 8. Advanced Analytics & CSV Export
router.get('/analytics', getAdminAnalytics);
router.get('/export/:resource', exportAdminCSV);

// 9. Admin Activity Logs (Audit Trail)
router.get('/audit-logs', getAdminAuditLogs);

// 10. Platform Settings
router.get('/settings', getAdminSettings);
router.patch('/settings', updateAdminSetting);

export default router;
