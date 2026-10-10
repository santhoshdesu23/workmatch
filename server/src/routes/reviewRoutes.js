import { Router } from 'express';
import { createReview, getUserReviews } from '../controllers/reviewsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', requireAuth, createReview);
router.get('/:userId', getUserReviews);

export default router;
