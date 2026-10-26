import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { EmailOtp } from '../models/EmailOtp.js';
import { ROLES } from '../config/constants.js';
import { signToken } from '../config/jwt.js';
import { sendPasswordResetEmail, sendVerificationEmail, sendVerificationOtpEmail } from '../services/emailService.js';
import { validateNameField } from '../utils/nameValidator.js';

const ALLOWED_REGISTRATION_ROLES = [ROLES.WORKER, ROLES.EMPLOYER];

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one number or special character.';
  }
  return null;
}

export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, name, email, password, role, businessName } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required.'
      });
    }

    let trimmedFirst = '';
    let trimmedLast = '';
    let finalName = '';

    if (firstName !== undefined || lastName !== undefined) {
      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'Both first name and last name are required.'
        });
      }
      const firstError = validateNameField(firstName, 'First name');
      if (firstError) {
        return res.status(400).json({ success: false, message: firstError });
      }
      const lastError = validateNameField(lastName, 'Last name');
      if (lastError) {
        return res.status(400).json({ success: false, message: lastError });
      }
      trimmedFirst = firstName.trim();
      trimmedLast = lastName.trim();
      finalName = `${trimmedFirst} ${trimmedLast}`;
    } else if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required.'
        });
      }
      const trimmed = name.trim();
      if (trimmed.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot exceed 100 characters.'
        });
      }
      finalName = trimmed;
      const parts = trimmed.split(/\s+/);
      trimmedFirst = parts[0]?.slice(0, 30) || '';
      trimmedLast = parts.slice(1).join(' ')?.slice(0, 30) || trimmedFirst;
    } else {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required.'
      });
    }

    // Role Escalation Protection: Public registration can NEVER create an admin account
    if (!ALLOWED_REGISTRATION_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration role. Allowed roles: worker, employer.'
      });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isEnforced = isProduction || process.env.REQUIRE_REGISTRATION_VERIFICATION === 'true' || req.headers['x-require-otp-verification'] === 'true';

    // Verify backend OTP state (do not trust frontend emailVerified flag)
    const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });
    let isEmailOtpVerified = false;

    if (otpRecord && otpRecord.verified && otpRecord.verifiedExpires && new Date(otpRecord.verifiedExpires).getTime() > Date.now()) {
      if (req.body.verificationToken) {
        const hashedProvided = crypto.createHash('sha256').update(String(req.body.verificationToken).trim()).digest('hex');
        if (otpRecord.verificationToken && otpRecord.verificationToken === hashedProvided) {
          isEmailOtpVerified = true;
        }
      } else {
        isEmailOtpVerified = true;
      }
    }

    if (isEnforced && !isEmailOtpVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email address has not been verified. Please complete email verification before registering.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // If OTP verified on backend, mark user emailVerified: true immediately
    const userEmailVerified = Boolean(isEmailOtpVerified);
    let hashedVerificationToken = undefined;
    let emailVerificationExpires = undefined;
    let verificationToken = undefined;

    if (!isEmailOtpVerified) {
      // Legacy flow for backward-compatible test fixtures
      verificationToken = crypto.randomBytes(32).toString('hex');
      hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    const user = await User.create({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      name: finalName,
      email: normalizedEmail,
      passwordHash,
      role,
      passwordChangedAt: new Date(),
      emailVerified: userEmailVerified,
      verificationStatus: userEmailVerified ? 'verified' : 'unverified',
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires
    });

    // If OTP record was consumed, clean it up so it cannot be reused
    if (otpRecord && isEmailOtpVerified) {
      await EmailOtp.deleteOne({ _id: otpRecord._id });
    }

    // Create appropriate profile
    let profile = null;
    if (role === ROLES.WORKER) {
      profile = await WorkerProfile.create({
        user: user._id,
        skills: [],
        availability: { isAvailable: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
      });
    } else if (role === ROLES.EMPLOYER) {
      profile = await EmployerProfile.create({
        user: user._id,
        businessName: businessName?.trim() || `${finalName}'s Organization`
      });
    }

    let emailResult = { success: true };
    if (!userEmailVerified && verificationToken) {
      // Safely dispatch verification email for unverified legacy accounts
      emailResult = await sendVerificationEmail({
        to: user.email,
        verificationToken,
        userName: user.name
      });

      if (!emailResult.success) {
        console.error(`[Auth] Verification email dispatch failed for user ${user._id}: ${emailResult.error}`);
      }
    }

    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    const isLiveEmailProvider = provider === 'resend' || provider === 'brevo';
    const canExposeDevVerificationToken = process.env.NODE_ENV !== 'production' && !isLiveEmailProvider && !userEmailVerified;

    const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });

    res.status(201).json({
      success: true,
      message: userEmailVerified
        ? 'Account registered successfully.'
        : emailResult.success
          ? 'Account registered successfully. Verification email sent. Please check your inbox.'
          : "Account registered successfully, but we couldn't send your verification email. Please use the resend verification option.",
      emailSent: Boolean(emailResult.success),
      token,
      user: {
        id: user._id,
        name: user.name,
        firstName: user.firstName || (user.name ? user.name.split(/\s+/)[0] : ''),
        lastName: user.lastName || (user.name ? user.name.split(/\s+/).slice(1).join(' ') : ''),
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        verificationStatus: user.verificationStatus,
        profile
      },
      ...(canExposeDevVerificationToken ? { devVerificationToken: verificationToken } : {})
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Prevent account enumeration by timing
      await bcrypt.compare(password, '$2a$12$e8Y3yq2x84H65v6J7oO42u4j4Qj4Qj4Qj4Qj4Qj4Qj4Qj4Qj4Qj4Q');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(403).json({
        success: false,
        message: 'This account has been deleted.'
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account has been suspended. Please contact platform administrators.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    let profile = null;
    if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ user: user._id });
    } else if (user.role === ROLES.EMPLOYER) {
      profile = await EmployerProfile.findOne({ user: user._id });
    }

    const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });

    const nameParts = (user.name || '').trim().split(/\s+/);
    const firstName = user.firstName || nameParts[0] || '';
    const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        verificationStatus: user.verificationStatus,
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    let profile = null;

    if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ user: user._id });
    } else if (user.role === ROLES.EMPLOYER) {
      profile = await EmployerProfile.findOne({ user: user._id });
    }

    const nameParts = (user.name || '').trim().split(/\s+/);
    const firstName = user.firstName || nameParts[0] || '';
    const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        verificationStatus: user.verificationStatus,
        accountStatus: user.accountStatus,
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    let resetToken = null;
    let deliverySuccess = true;

    if (user) {
      // Generate cryptographically secure random token
      resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Dispatch reset URL to user's registered email
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        resetToken,
        userName: user.name
      });

      if (!emailResult.success) {
        deliverySuccess = false;
        console.error(`[Auth] Password reset email delivery failed for user ${user._id}: ${emailResult.error}`);
        // If delivery failed in production, clear the active token to prevent dangling state
        if (process.env.NODE_ENV === 'production') {
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          await user.save();
        }
      }
    }

    // Expose debug token only in mock/test mode; NEVER when Brevo, Resend, or production is active
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    const isLiveEmailProvider = provider === 'resend' || provider === 'brevo';
    const canExposeDevToken = process.env.NODE_ENV !== 'production' && !isLiveEmailProvider;

    res.status(200).json({
      success: true,
      message: 'Password reset instructions have been requested. If an account exists with this email address, password recovery instructions have been sent. Check your inbox if the account is eligible.',
      emailSent: deliverySuccess,
      ...(canExposeDevToken && resetToken ? { devResetToken: resetToken } : {})
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required.'
      });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You may now log in.'
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password does not match.'
      });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue refreshed token with incremented tokenVersion
    const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
      token
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = req.body?.token;
    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    // Atomic conditional consumption: guarantees only exactly one concurrent request can consume the token
    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() }
      },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 }
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email verification token is invalid or has expired.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now apply for shifts and publish job listings.'
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    let targetUser = null;

    if (req.user && req.user._id) {
      targetUser = await User.findById(req.user._id);
    } else if (req.body?.email) {
      const normalizedEmail = String(req.body.email).toLowerCase().trim();
      targetUser = await User.findOne({ email: normalizedEmail });
    }

    let verificationToken = null;

    if (targetUser) {
      if (targetUser.emailVerified) {
        if (req.user) {
          return res.status(200).json({
            success: true,
            message: 'Your email address is already verified.'
          });
        }
        // If unauthenticated caller provided an already-verified email, fall through to generic response
      } else {
        verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        targetUser.emailVerificationToken = hashedToken;
        targetUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await targetUser.save();

        const emailResult = await sendVerificationEmail({
          to: targetUser.email,
          verificationToken,
          userName: targetUser.name
        });

        if (!emailResult.success) {
          console.error(`[Auth] Resend verification email dispatch failed for user ${targetUser._id}: ${emailResult.error}`);
          return res.status(502).json({
            success: false,
            message: "We couldn't send your verification email. Please try again."
          });
        }
      }
    }

    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    const isLiveEmailProvider = provider === 'resend' || provider === 'brevo';
    const canExposeDevVerificationToken = process.env.NODE_ENV !== 'production' && !isLiveEmailProvider;

    // Generic response prevents account enumeration
    res.status(200).json({
      success: true,
      message: 'If an unverified account is associated with this email address, verification instructions have been dispatched.',
      ...(canExposeDevVerificationToken && verificationToken ? { devVerificationToken: verificationToken } : {})
    });
  } catch (error) {
    next(error);
  }
};

export const submitVerificationRequest = async (req, res, next) => {
  try {
    const { verificationType, submittedData } = req.body;
    const userId = req.user._id;

    if (!verificationType || !submittedData) {
      return res.status(400).json({
        success: false,
        message: 'verificationType and submittedData are required.'
      });
    }

    const allowedTypes = ['identity', 'business_license', 'tax_id', 'contact'];
    if (!allowedTypes.includes(verificationType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid verificationType. Allowed: ${allowedTypes.join(', ')}`
      });
    }

    // Check if user already has a pending verification
    const pending = await VerificationRequest.findOne({ user: userId, status: 'pending' });
    if (pending) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending verification request under administrative review.'
      });
    }

    const vReq = await VerificationRequest.create({
      user: userId,
      verificationType,
      status: 'pending',
      submittedData: {
        businessName: submittedData.businessName ? String(submittedData.businessName).slice(0, 100) : '',
        registrationNumber: submittedData.registrationNumber ? String(submittedData.registrationNumber).slice(0, 50) : '',
        documentType: submittedData.documentType ? String(submittedData.documentType).slice(0, 50) : '',
        documentRef: submittedData.documentRef ? String(submittedData.documentRef).slice(0, 100) : ''
      }
    });

    // Update user status to pending
    await User.findByIdAndUpdate(userId, { verificationStatus: 'pending' });
    if (req.user.role === ROLES.WORKER) {
      await WorkerProfile.findOneAndUpdate({ user: userId }, { verificationStatus: 'pending' });
    } else if (req.user.role === ROLES.EMPLOYER) {
      await EmployerProfile.findOneAndUpdate({ user: userId }, { verificationStatus: 'pending' });
    }

    res.status(201).json({
      success: true,
      message: 'Verification request submitted successfully for moderation.',
      verification: vReq
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dispatches a 4-digit verification OTP to the user's email before registration.
 * Applies 60-second cooldown, 5-minute expiration, and secure HMAC storage.
 */
export const sendRegistrationOtp = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Check if an account already exists with this email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    // 60-second cooldown check per email
    const existingOtp = await EmailOtp.findOne({ email: normalizedEmail });
    if (existingOtp && existingOtp.lastSentAt) {
      const timeSinceLast = Date.now() - new Date(existingOtp.lastSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        const remainingSeconds = Math.ceil((60000 - timeSinceLast) / 1000);
        return res.status(429).json({
          success: false,
          cooldownRemaining: remainingSeconds,
          message: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another code.`
        });
      }
    }

    // Generate cryptographically secure 4-digit numeric code (0000 - 9999, preserving leading zeros)
    const randomVal = crypto.randomInt(0, 10000);
    const otp = String(randomVal).padStart(4, '0');

    // Secure HMAC of OTP (secret kept in backend environment)
    const hmacSecret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'workmatch-secure-otp-hmac-key';
    const otpHash = crypto.createHmac('sha256', hmacSecret).update(otp).digest('hex');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    await EmailOtp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          otpHash,
          attempts: 0,
          expiresAt,
          lastSentAt: new Date(),
          verified: false,
          verifiedAt: null,
          verificationToken: null,
          verifiedExpires: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send OTP email using existing Brevo integration
    const emailResult = await sendVerificationOtpEmail({
      to: normalizedEmail,
      otp,
      userName: 'Future WorkMatch Member'
    });

    if (!emailResult.success) {
      console.error(`[Auth] OTP dispatch failed for email ${normalizedEmail}: ${emailResult.error}`);
      return res.status(502).json({
        success: false,
        message: "We couldn't deliver the verification code to your email. Please check your address and try again."
      });
    }

    // Never leak OTP in API response or logs
    res.status(200).json({
      success: true,
      message: 'Verification code sent. Check your inbox.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies the 4-digit OTP code against the stored secure HMAC.
 * Enforces 5-minute expiry and maximum 5 verification attempts.
 */
export const verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!otp || typeof otp !== 'string' || !/^\d{4}$/.test(otp.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A 4-digit verification code is required.'
      });
    }

    const cleanOtp = otp.trim();
    const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });

    if (!otpRecord || !otpRecord.otpHash) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or was not requested. Please request a new code.'
      });
    }

    if (otpRecord.expiresAt && new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    if ((otpRecord.attempts || 0) >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.'
      });
    }

    const hmacSecret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'workmatch-secure-otp-hmac-key';
    const computedHash = crypto.createHmac('sha256', hmacSecret).update(cleanOtp).digest('hex');

    const expectedBuf = Buffer.from(otpRecord.otpHash, 'hex');
    const actualBuf = Buffer.from(computedHash, 'hex');

    const isMatch = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isMatch) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      otpRecord.attempts = newAttempts;
      await otpRecord.save();

      const remaining = Math.max(0, 5 - newAttempts);
      return res.status(400).json({
        success: false,
        remainingAttempts: remaining,
        message: remaining > 0
          ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Please request a new code.'
      });
    }

    // Success: Generate cryptographically secure single-use proof token
    const verificationSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationSessionToken).digest('hex');

    otpRecord.verified = true;
    otpRecord.verifiedAt = new Date();
    otpRecord.verificationToken = tokenHash;
    otpRecord.verifiedExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins to complete registration form
    otpRecord.otpHash = undefined; // Invalidate OTP immediately to prevent replay
    await otpRecord.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      verificationToken: verificationSessionToken
    });
  } catch (error) {
    next(error);
  }
};
