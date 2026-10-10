import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/notificationsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.patch('/:notificationId/read', requireAuth, markNotificationRead);
router.post('/read-all', requireAuth, markAllNotificationsRead);

export default router;
