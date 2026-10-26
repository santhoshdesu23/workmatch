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
  submitVerificationRequest,
  sendRegistrationOtp,
  verifyRegistrationOtp
} from '../controllers/authController.js';
import { requireAuth, optionalAuth, requireRole } from '../middleware/authMiddleware.js';
import { verificationRateLimiter } from '../middleware/rateLimiters.js';
import { deleteMyAccount } from '../controllers/accountController.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAuth, changePassword);
router.delete('/account', requireAuth, requireRole(ROLES.WORKER, ROLES.EMPLOYER), deleteMyAccount);
router.post('/verify-email', verificationRateLimiter, verifyEmail);
router.post('/resend-verification', verificationRateLimiter, optionalAuth, resendVerification);
router.post('/verification-request', requireAuth, submitVerificationRequest);

// 4-Digit Registration Email OTP Verification endpoints
router.post('/send-otp', verificationRateLimiter, sendRegistrationOtp);
router.post('/verify-otp', verificationRateLimiter, verifyRegistrationOtp);
router.post('/send-registration-otp', verificationRateLimiter, sendRegistrationOtp);
router.post('/verify-registration-otp', verificationRateLimiter, verifyRegistrationOtp);

export default router;
