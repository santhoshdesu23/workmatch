import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { ROLES } from '../config/constants.js';
import { signToken } from '../config/jwt.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';

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
    const { name, email, password, role, businessName } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.'
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

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate cryptographically secure verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      passwordChangedAt: new Date(),
      emailVerified: false,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires
    });

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
        businessName: businessName?.trim() || `${name.trim()}'s Organization`
      });
    }

    // Safely dispatch verification email
    const emailResult = await sendVerificationEmail({
      to: user.email,
      verificationToken,
      userName: user.name
    });

    if (!emailResult.success) {
      console.error(`[Auth] Verification email dispatch failed for user ${user._id}: ${emailResult.error}`);
    }

    const canExposeDevVerificationToken = process.env.NODE_ENV !== 'production' && (process.env.EMAIL_PROVIDER || '').toLowerCase() !== 'resend';

    const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Please check your email to verify your account.',
      token,
      user: {
        id: user._id,
        name: user.name,
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

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
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

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
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

    // Expose debug token only in mock/test mode; NEVER when Resend or production is active
    const canExposeDevToken = process.env.NODE_ENV !== 'production' && (process.env.EMAIL_PROVIDER || '').toLowerCase() !== 'resend';

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, password recovery instructions have been sent.',
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
        }
      }
    }

    const canExposeDevVerificationToken = process.env.NODE_ENV !== 'production' && (process.env.EMAIL_PROVIDER || '').toLowerCase() !== 'resend';

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
