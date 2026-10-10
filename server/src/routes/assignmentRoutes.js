import { Router } from 'express';
import {
  getMyAssignments,
  updateAssignmentStatus,
  confirmCompletion
} from '../controllers/assignmentsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/me', requireAuth, getMyAssignments);
router.patch('/:assignmentId/status', requireAuth, updateAssignmentStatus);
router.post('/:assignmentId/confirm-completion', requireAuth, confirmCompletion);

export default router;
