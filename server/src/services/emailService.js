/**
 * WorkMatch Email Service
 * Official Resend SDK Integration for transactional email delivery.
 * Enforces production safety: mock email is strictly prohibited in production environments.
 */

import { Resend } from 'resend';

let mockEmailQueue = [];
let mockFailureEnabled = false;
let customResendClient = null;
let customBrevoFetch = null;

/**
 * Detects if a given sender string or email address contains a placeholder/dummy value.
 * Matches:
 * - your_verified_sender_email@example.com
 * - your_verified_sender@example.com
 * - any @example.com, @example.org, @example.net, @test.local
 * - strings containing 'placeholder' or 'your_verified'
 */
export function isPlaceholderSender(senderStrOrEmail) {
  if (!senderStrOrEmail || typeof senderStrOrEmail !== 'string') return false;
  const lower = senderStrOrEmail.toLowerCase().trim();
  const placeholderPatterns = [
    /your_verified_sender_email@example\.com/i,
    /your_verified_sender@example\.com/i,
    /@example\.(com|org|net)$/i,
    /@example\.(com|org|net)>/i,
    /<.*@example\.(com|org|net)>/i,
    /example\.com/i,
    /your_verified_sender/i,
    /your_email/i,
    /placeholder/i
  ];
  return placeholderPatterns.some((pattern) => pattern.test(lower));
}

export function parseEmailFrom(fromHeader, defaultEmail = 'security@workmatch.app', defaultName = 'WorkMatch Security') {
  if (!fromHeader || typeof fromHeader !== 'string') {
    return { name: defaultName, email: defaultEmail };
  }
  const trimmed = fromHeader.trim().replace(/^["']|["']$/g, '').trim();
  const match = trimmed.match(/^(?:(.*?)<)?([^<>]+)>?$/);
  if (!match) {
    const cleanEmail = trimmed.replace(/^["']|["']$/g, '').trim();
    return { name: defaultName, email: cleanEmail || defaultEmail };
  }
  const name = match[1] ? match[1].trim().replace(/^["']|["']$/g, '').trim() : defaultName;
  const email = match[2] ? match[2].trim().replace(/^["']|["']$/g, '').trim() : defaultEmail;
  return { name: name || defaultName, email: email || defaultEmail };
}

/**
 * Resolves the effective, verified sender for transactional email delivery.
 * Enforces verified sender defaults (e.g. santhoshdesu23@gmail.com for Brevo)
 * and guards against unconfigured placeholder addresses.
 *
 * @param {string} [provider] - 'brevo', 'resend', or 'mock'
 * @returns {{ name: string, email: string, formatted: string }}
 */
export function resolveSender(provider = process.env.EMAIL_PROVIDER) {
  const providerLower = (provider || '').toLowerCase();
  const defaultBrevoEmail = 'santhoshdesu23@gmail.com';
  const defaultResendEmail = 'security@workmatch.app';
  const defaultName = 'WorkMatch Security';

  const defaultEmail = providerLower === 'brevo' ? defaultBrevoEmail : defaultResendEmail;

  const rawFrom = process.env.EMAIL_FROM;

  // If EMAIL_FROM is unset, empty, or contains a placeholder
  if (!rawFrom || rawFrom.trim() === '' || isPlaceholderSender(rawFrom)) {
    if (rawFrom && isPlaceholderSender(rawFrom)) {
      console.warn(
        `[EmailService] Detected placeholder address in EMAIL_FROM ("${rawFrom}"). Safe fallback engaged: using verified sender "${defaultEmail}".`
      );
    }
    return {
      name: defaultName,
      email: defaultEmail,
      formatted: `${defaultName} <${defaultEmail}>`
    };
  }

  const parsed = parseEmailFrom(rawFrom, defaultEmail, defaultName);

  if (isPlaceholderSender(parsed.email)) {
    console.warn(
      `[EmailService] Detected parsed placeholder sender "${parsed.email}". Falling back to verified sender "${defaultEmail}".`
    );
    return {
      name: defaultName,
      email: defaultEmail,
      formatted: `${defaultName} <${defaultEmail}>`
    };
  }

  return {
    name: parsed.name || defaultName,
    email: parsed.email || defaultEmail,
    formatted: `${parsed.name || defaultName} <${parsed.email || defaultEmail}>`
  };
}

/**
 * Validates email configuration for production safety and placeholder prevention.
 * Must fail fast if production attempts to boot without valid credentials or with placeholder senders.
 */
export function validateEmailConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (isProduction) {
    if (provider !== 'resend' && provider !== 'brevo') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: EMAIL_PROVIDER must be explicitly set to "resend" or "brevo" in production. Mock email fallback is prohibited.'
      );
    }
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error(
          'FATAL CONFIGURATION ERROR: RESEND_API_KEY environment variable is missing or empty in production.'
        );
      }
    }
    if (provider === 'brevo') {
      const apiKey = process.env.BREVO_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error(
          'FATAL CONFIGURATION ERROR: BREVO_API_KEY environment variable is missing or empty in production.'
        );
      }
    }
  }

  // Prevent placeholder senders across all environments when a live provider is selected
  if (provider === 'brevo' || provider === 'resend') {
    const rawFrom = process.env.EMAIL_FROM;
    if (rawFrom && isPlaceholderSender(rawFrom)) {
      throw new Error(
        `FATAL CONFIGURATION ERROR: EMAIL_FROM contains placeholder address ("${rawFrom}"). You must configure a real, verified sender email (e.g. "WorkMatch Security <santhoshdesu23@gmail.com>").`
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
 * Dispatches a transactional email using the official Brevo HTTP REST API.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.senderName - Sender display name
 * @param {string} params.senderEmail - Verified sender email address
 * @param {string} params.subject - Email subject
 * @param {string} params.htmlContent - Email HTML body
 * @param {string} params.textContent - Email text fallback
 * @param {string} [params.userName] - Recipient name
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, statusCode?: number }>}
 */
export async function sendViaBrevo({ to, senderName, senderEmail, subject, htmlContent, textContent, userName }) {
  if (isPlaceholderSender(senderEmail)) {
    const errorMsg = `Brevo dispatch blocked: sender email "${senderEmail}" is a placeholder address. Must use a verified sender address.`;
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    const errorMsg = 'Brevo dispatch failed: BREVO_API_KEY environment variable is missing.';
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const fetchFn = customBrevoFetch || globalThis.fetch;
  if (!fetchFn) {
    const errorMsg = 'Global fetch is not available in this environment.';
    console.error(`[EmailService] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    // Diagnostic safe logging (Never logs keys, passwords, or tokens)
    console.log(`[EmailService:BrevoDispatch] provider: brevo | sender: "${senderName || 'WorkMatch Security'}" <${senderEmail}>`);

    const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey.trim(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: senderName || 'WorkMatch Security',
          email: senderEmail
        },
        to: [
          {
            email: to,
            name: userName || to
          }
        ],
        subject,
        htmlContent,
        textContent
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || `Brevo API HTTP ${res.status}: ${res.statusText || 'Error'}`;
      // Safe diagnostic logging: do not log apiKey or tokens
      console.error(`[EmailService] Brevo API error (${res.status}):`, errorMsg);
      return { success: false, error: errorMsg, statusCode: res.status };
    }

    return {
      success: true,
      messageId: data?.messageId || 'brevo-accepted'
    };
  } catch (err) {
    console.error('[EmailService] Brevo network exception during dispatch:', err.message);
    return { success: false, error: err.message };
  }
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
  resetResendClient: () => { customResendClient = null; },
  setBrevoFetch: (mockFetch) => { customBrevoFetch = mockFetch; },
  resetBrevoFetch: () => { customBrevoFetch = null; }
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

  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  const sender = resolveSender(emailProvider);
  const senderEmail = sender.formatted;

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

  // 1. Strict Production Guard: NEVER silently use mock email in production
  if (isProduction && emailProvider !== 'resend' && emailProvider !== 'brevo') {
    const errorMsg = 'Mock email provider is prohibited in production.';
    console.error(`[EmailService] Security violation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Brevo HTTP REST API Dispatch
  if (emailProvider === 'brevo') {
    return await sendViaBrevo({
      to,
      senderName: sender.name,
      senderEmail: sender.email,
      subject,
      htmlContent,
      textContent,
      userName
    });
  }

  // 3. Mock Transport (Explicit mock mode or test/dev default when live provider is not selected)
  if (emailProvider === 'mock' || (isTest && emailProvider !== 'resend') || (!isProduction && emailProvider !== 'resend' && !process.env.RESEND_API_KEY && !customResendClient)) {
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

  // 4. Official Resend SDK Dispatch
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

  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  const sender = resolveSender(emailProvider);
  const senderEmail = sender.formatted;

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

  // 1. Strict Production Guard
  if (isProduction && emailProvider !== 'resend' && emailProvider !== 'brevo') {
    const errorMsg = 'Mock email provider is prohibited in production.';
    console.error(`[EmailService] Security violation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Brevo HTTP REST API Dispatch
  if (emailProvider === 'brevo') {
    return await sendViaBrevo({
      to,
      senderName: sender.name,
      senderEmail: sender.email,
      subject,
      htmlContent,
      textContent,
      userName
    });
  }

  // 3. Mock Transport
  if (emailProvider === 'mock' || (isTest && emailProvider !== 'resend') || (!isProduction && emailProvider !== 'resend' && !process.env.RESEND_API_KEY && !customResendClient)) {
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

  // 4. Official Resend SDK Dispatch
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

/**
 * Dispatches a 4-digit verification OTP code to the recipient email address.
 * Reuses the existing Brevo, Resend, or test mock integrations.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.otp - 4-digit numeric string (0000-9999)
 * @param {string} [params.userName] - Recipient display name
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendVerificationOtpEmail({ to, otp, userName = 'WorkMatch User' }) {
  if (!to || !otp) {
    return { success: false, error: 'Recipient email and verification OTP are required.' };
  }

  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  const sender = resolveSender(emailProvider);
  const senderEmail = sender.formatted;

  const subject = 'WorkMatch — Your 4-Digit Verification Code';
  const textContent = `Hello ${userName},\n\nYour WorkMatch verification code is: ${otp}\n\nThis 4-digit code will expire in 5 minutes. Enter this code on the registration page to verify your email address.\n\nIf you did not request this verification code, please ignore this email.\n\n— The WorkMatch Security Team`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="color: #0f172a; font-size: 20px; margin: 0; font-weight: 700;">WorkMatch Security</h1>
      </div>
      <h2 style="color: #0f172a; font-size: 17px; margin-top: 0;">Verify Your Email Address</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello ${userName},</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Thank you for registering on WorkMatch. Please use the following 4-digit verification code to confirm your email address:</p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #059669; padding: 14px 32px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #065f46;">
          ${otp}
        </div>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4; text-align: center;">This code will expire in <strong>5 minutes</strong>.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this verification code, you can safely ignore this email.</p>
    </div>
  `;

  // 1. Strict Production Guard
  if (isProduction && emailProvider !== 'resend' && emailProvider !== 'brevo') {
    const errorMsg = 'Mock email provider is prohibited in production.';
    console.error(`[EmailService] Security violation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Brevo HTTP REST API Dispatch
  if (emailProvider === 'brevo') {
    return await sendViaBrevo({
      to,
      senderName: sender.name,
      senderEmail: sender.email,
      subject,
      htmlContent,
      textContent,
      userName
    });
  }

  // 3. Mock Transport
  if (emailProvider === 'mock' || (isTest && emailProvider !== 'resend') || (!isProduction && emailProvider !== 'resend' && !process.env.RESEND_API_KEY && !customResendClient)) {
    if (mockFailureEnabled) {
      console.error('[EmailService] Simulated transport failure for test verification');
      return { success: false, error: 'Simulated email provider network failure' };
    }

    mockEmailQueue.push({
      type: 'otp',
      to,
      from: senderEmail,
      subject,
      text: textContent,
      html: htmlContent,
      otp,
      sentAt: new Date()
    });

    return {
      success: true,
      messageId: `mock-otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
  }

  // 4. Official Resend SDK Dispatch
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

