import { Router } from 'express';
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  cancelJob,
  toggleSaveJob
} from '../controllers/jobsController.js';
import { applyToJob, getJobApplicants } from '../controllers/applicationsController.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { jobPostRateLimiter, applicationRateLimiter } from '../middleware/rateLimiters.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Public / optional auth discovery
router.get('/', optionalAuth, getJobs);
router.get('/:jobId', optionalAuth, getJobById);

// Protected employer endpoints
router.post('/', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), jobPostRateLimiter, createJob);
router.patch('/:jobId', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), updateJob);
router.post('/:jobId/cancel', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), cancelJob);

// Worker bookmarks
router.post('/:jobId/save', requireAuth, requireRole(ROLES.WORKER), toggleSaveJob);
router.delete('/:jobId/save', requireAuth, requireRole(ROLES.WORKER), toggleSaveJob);

// Application subroutes
router.post('/:jobId/apply', requireAuth, requireRole(ROLES.WORKER), applicationRateLimiter, applyToJob);
router.get('/:jobId/applications', requireAuth, requireRole(ROLES.EMPLOYER, ROLES.ADMIN), getJobApplicants);

export default router;
