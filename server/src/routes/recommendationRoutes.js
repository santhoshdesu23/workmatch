import { Router } from 'express';
import {
  getJobRecommendations,
  explainRecommendation,
  parseNlSearch
} from '../controllers/recommendationsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/jobs', requireAuth, requireRole(ROLES.WORKER), getJobRecommendations);
router.post('/explain', requireAuth, requireRole(ROLES.WORKER), explainRecommendation);
router.post('/nl-search', parseNlSearch);

export default router;
