import { Router } from 'express';
import { createReport } from '../controllers/reportsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', requireAuth, createReport);

export default router;
