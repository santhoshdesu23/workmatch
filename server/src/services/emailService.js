/**
 * WorkMatch Email Service
 * Official Resend SDK Integration for transactional email delivery.
 * Enforces production safety: mock email is strictly prohibited in production environments.
 */

import { Resend } from 'resend';

let mockEmailQueue = [];
let mockFailureEnabled = false;
let customResendClient = null;

/**
 * Validates email configuration for production safety.
 * Must fail fast if production attempts to boot without valid Resend credentials.
 */
export function validateEmailConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (provider !== 'resend') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: EMAIL_PROVIDER must be explicitly set to "resend" in production. Mock email fallback is prohibited.'
      );
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: RESEND_API_KEY environment variable is missing or empty in production.'
      );
    }
  }
}

/**
 * Resolves the Resend client instance.
 * Allows injection of mock client in automated tests.
 */
export function getResendClient() {
  if (customResendClient) return customResendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  return new Resend(apiKey);
}

/**
 * Configure mock email service behavior for tests
 */
export const _testEmailMock = {
  getSentEmails: () => [...mockEmailQueue],
  clearSentEmails: () => { mockEmailQueue = []; },
  setSimulateFailure: (shouldFail) => { mockFailureEnabled = shouldFail; },
  getLastEmail: () => mockEmailQueue[mockEmailQueue.length - 1] || null,
  setResendClient: (client) => { customResendClient = client; },
  resetResendClient: () => { customResendClient = null; }
};

/**
 * Sends a password reset email using the official Resend SDK.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.resetToken - Raw cryptographically secure random token (sent ONLY in the reset URL)
 * @param {string} [params.userName] - Recipient display name
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendPasswordResetEmail({ to, resetToken, userName = 'WorkMatch User' }) {
  if (!to || !resetToken) {
    return { success: false, error: 'Recipient email and reset token are required.' };
  }

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const senderEmail = process.env.EMAIL_FROM || 'WorkMatch Security <security@workmatch.app>';

  const subject = 'WorkMatch — Password Reset Request';
  const textContent = `Hello ${userName},\n\nA password reset request was received for your WorkMatch account.\n\nTo reset your password, visit the following secure link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this password reset, please ignore this email or contact support immediately.\n\n— The WorkMatch Security Team`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="color: #0f172a; font-size: 20px; margin: 0; font-weight: 700;">WorkMatch Security</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 17px; margin-top: 0;">Password Reset Request</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello ${userName},</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">A password reset was requested for your WorkMatch account. Click the button below to choose a new password. This link is single-use and will expire in <strong>1 hour</strong>.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 15px;">Reset My Password</a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #2563eb; font-size: 12px; word-break: break-all; margin: 8px 0 20px 0;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request a password reset, you can safely ignore this email. Your current password remains unchanged.</p>
    </div>
  `;

  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  // 1. Strict Production Guard: NEVER silently use mock email in production
  if (isProduction && emailProvider !== 'resend') {
    const errorMsg = 'Mock email provider is prohibited in production.';
    console.error(`[EmailService] Security violation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Mock Transport (Explicit mock mode or test/dev default when resend is not selected)
  if (emailProvider === 'mock' || (isTest && emailProvider !== 'resend') || (!isProduction && !process.env.RESEND_API_KEY && !customResendClient)) {
    if (mockFailureEnabled) {
      console.error('[EmailService] Simulated transport failure for test verification');
      return { success: false, error: 'Simulated email provider network failure' };
    }

    mockEmailQueue.push({
      to,
      from: senderEmail,
      subject,
      text: textContent,
      html: htmlContent,
      resetUrl,
      sentAt: new Date()
    });

    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
  }

  // 3. Official Resend SDK Dispatch
  const resend = getResendClient();
  if (!resend) {
    const errorMsg = 'Resend client is uninitialized: RESEND_API_KEY is missing.';
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html: htmlContent,
      text: textContent
    });

    if (error) {
      // Secure logging: never log API key, reset token, or complete URL
      console.error(`[EmailService] Resend API error (${error.name || 'Error'}):`, error.message || error);
      return { success: false, error: error.message || 'Resend provider error' };
    }

    return {
      success: true,
      messageId: data?.id || 'resend-delivered'
    };
  } catch (err) {
    // Catch network timeouts or unexpected exceptions
    console.error('[EmailService] Resend exception during dispatch:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an email verification link using the official Resend SDK.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.verificationToken - Raw cryptographically secure random token (sent ONLY in the verification URL)
 * @param {string} [params.userName] - Recipient display name
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendVerificationEmail({ to, verificationToken, userName = 'WorkMatch User' }) {
  if (!to || !verificationToken) {
    return { success: false, error: 'Recipient email and verification token are required.' };
  }

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verifyUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const senderEmail = process.env.EMAIL_FROM || 'WorkMatch Security <security@workmatch.app>';

  const subject = 'WorkMatch — Verify Your Email Address';
  const textContent = `Hello ${userName},\n\nThank you for joining WorkMatch. Please verify your email address to activate your ability to apply for shifts or publish job listings.\n\nTo verify your email, visit the following secure link (valid for 24 hours):\n${verifyUrl}\n\nIf you did not create a WorkMatch account, please ignore this email.\n\n— The WorkMatch Security Team`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="color: #0f172a; font-size: 20px; margin: 0; font-weight: 700;">WorkMatch Security</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 17px; margin-top: 0;">Verify Your Email Address</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello ${userName},</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Thank you for registering on WorkMatch. Email verification is required to safeguard our marketplace and enable shift applications and job postings. Click the button below to confirm your address (valid for <strong>24 hours</strong>):</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyUrl}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 15px;">Verify Email Address</a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #059669; font-size: 12px; word-break: break-all; margin: 8px 0 20px 0;">${verifyUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not register for WorkMatch, you can safely ignore this email.</p>
    </div>
  `;

  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  // 1. Strict Production Guard
  if (isProduction && emailProvider !== 'resend') {
    const errorMsg = 'Mock email provider is prohibited in production.';
    console.error(`[EmailService] Security violation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Mock Transport
  if (emailProvider === 'mock' || (isTest && emailProvider !== 'resend') || (!isProduction && !process.env.RESEND_API_KEY && !customResendClient)) {
    if (mockFailureEnabled) {
      console.error('[EmailService] Simulated transport failure for test verification');
      return { success: false, error: 'Simulated email provider network failure' };
    }

    mockEmailQueue.push({
      type: 'verification',
      to,
      from: senderEmail,
      subject,
      text: textContent,
      html: htmlContent,
      verifyUrl,
      sentAt: new Date()
    });

    return {
      success: true,
      messageId: `mock-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
  }

  // 3. Official Resend SDK Dispatch
  const resend = getResendClient();
  if (!resend) {
    const errorMsg = 'Resend client is uninitialized: RESEND_API_KEY is missing.';
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html: htmlContent,
      text: textContent
    });

    if (error) {
      console.error(`[EmailService] Resend API error (${error.name || 'Error'}):`, error.message || error);
      if (!isProduction) {
        console.log(`\n[WorkMatch Dev Helper] Verification link for ${to} (blocked by Resend sandbox policy):\n${verifyUrl}\n`);
      }
      return { success: false, error: error.message || 'Resend provider error' };
    }

    return {
      success: true,
      messageId: data?.id || 'resend-delivered'
    };
  } catch (err) {
    console.error('[EmailService] Resend exception during dispatch:', err.message);
    return { success: false, error: err.message };
  }
}
