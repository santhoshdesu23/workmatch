import { Router } from 'express';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
  submitVerificationRequest
} from '../controllers/authController.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import { verificationRateLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAuth, changePassword);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', verificationRateLimiter, optionalAuth, resendVerification);
router.post('/verification-request', requireAuth, submitVerificationRequest);

export default router;
