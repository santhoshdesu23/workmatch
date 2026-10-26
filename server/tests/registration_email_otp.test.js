import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { EmailOtp } from '../src/models/EmailOtp.js';
import { _testEmailMock } from '../src/services/emailService.js';

describe('Registration 4-Digit Email OTP Verification Test Suite', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();
  });

  afterAll(async () => {
    delete process.env.REQUIRE_REGISTRATION_VERIFICATION;
    await disconnectDB();
  });

  beforeEach(async () => {
    _testEmailMock.resetBrevoFetch();
    _testEmailMock.resetResendClient();
    _testEmailMock.clearSentEmails();
    _testEmailMock.setSimulateFailure(false);
    delete process.env.BREVO_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.REQUIRE_REGISTRATION_VERIFICATION = 'true';
  });

  describe('1. Sending Registration OTP', () => {
    it('validates email format before sending code', async () => {
      const res1 = await request(app).post('/api/auth/send-registration-otp').send({});
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app).post('/api/auth/send-registration-otp').send({ email: 'not-an-email' });
      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/valid email/i);
    });

    it('rejects sending OTP if an account already exists with the email', async () => {
      const existingEmail = `existing.${Date.now()}@test.local`;
      await User.create({
        name: 'Existing User',
        email: existingEmail,
        passwordHash: 'dummyhash123',
        role: 'worker'
      });

      const res = await request(app).post('/api/auth/send-registration-otp').send({ email: existingEmail });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('dispatches a 4-digit code, stores only HMAC in DB, and never leaks OTP in response', async () => {
      const email = `otp.user.${Date.now()}@test.local`;
      const res = await request(app).post('/api/auth/send-registration-otp').send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Verification code sent');
      expect(res.body.otp).toBeUndefined(); // NEVER leaked in response

      // Inspect DB: HMAC must be stored, NOT the plaintext OTP
      const record = await EmailOtp.findOne({ email });
      expect(record).not.toBeNull();
      expect(record.otpHash).toBeDefined();
      expect(record.otpHash).toHaveLength(64); // SHA-256 hex length
      expect(record.verified).toBe(false);
      expect(record.attempts).toBe(0);
      expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Inspect dispatched mock email
      const sentEmails = _testEmailMock.getSentEmails();
      const dispatched = sentEmails.find((e) => e.to === email && e.type === 'otp');
      expect(dispatched).toBeDefined();
      expect(dispatched.otp).toMatch(/^\d{4}$/); // 4 numeric digits

      // Verify HMAC matches
      const hmacSecret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'workmatch-secure-otp-hmac-key';
      const expectedHash = crypto.createHmac('sha256', hmacSecret).update(dispatched.otp).digest('hex');
      expect(record.otpHash).toBe(expectedHash);
    });

    it('enforces 60-second cooldown on resending code', async () => {
      const email = `cooldown.${Date.now()}@test.local`;

      // First send succeeds
      const res1 = await request(app).post('/api/auth/send-registration-otp').send({ email });
      expect(res1.status).toBe(200);

      // Immediate second send is rejected with 429
      const res2 = await request(app).post('/api/auth/send-registration-otp').send({ email });
      expect(res2.status).toBe(429);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toMatch(/Please wait \d+ seconds/i);
      expect(res2.body.cooldownRemaining).toBeGreaterThan(0);
    });

    it('resending after 60 seconds generates a new OTP and invalidates the previous code', async () => {
      const email = `resend.invalidate.${Date.now()}@test.local`;

      // 1. Send first code
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const firstOtp = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;

      // Simulate 61 seconds passing by updating lastSentAt in DB
      await EmailOtp.findOneAndUpdate(
        { email },
        { $set: { lastSentAt: new Date(Date.now() - 65 * 1000) } }
      );

      // 2. Resend code
      const res2 = await request(app).post('/api/auth/send-registration-otp').send({ email });
      expect(res2.status).toBe(200);

      const allSent = _testEmailMock.getSentEmails().filter((e) => e.to === email);
      expect(allSent).toHaveLength(2);
      const secondOtp = allSent[1].otp;

      // 3. Attempting to verify the old (first) OTP is REJECTED
      const failRes = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: firstOtp
      });
      expect(failRes.status).toBe(400);

      // 4. Verifying the new (second) OTP SUCCEEDS
      const successRes = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: secondOtp
      });
      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);
      expect(successRes.body.verificationToken).toBeDefined();
    });
  });

  describe('2. Verifying Registration OTP', () => {
    it('successfully verifies a correct 4-digit code and returns verification token', async () => {
      const email = `verify.correct.${Date.now()}@test.local`;
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const sentCode = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;

      const res = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: sentCode
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Email verified successfully/i);
      expect(res.body.verificationToken).toBeDefined();

      // DB record updated
      const record = await EmailOtp.findOne({ email });
      expect(record.verified).toBe(true);
      expect(record.verifiedAt).toBeDefined();
      expect(record.otpHash).toBeUndefined(); // Cleared to prevent replay
    });

    it('preserves leading zeros in 4-digit codes (e.g. 0123 or 0007)', async () => {
      const email = `leading.zero.${Date.now()}@test.local`;
      const leadingZeroCode = '0482';

      // Manually set an OTP with leading zero
      const hmacSecret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'workmatch-secure-otp-hmac-key';
      const otpHash = crypto.createHmac('sha256', hmacSecret).update(leadingZeroCode).digest('hex');

      await EmailOtp.create({
        email,
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        lastSentAt: new Date(),
        verified: false
      });

      // Verify with the exact string "0482"
      const res = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: '0482'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const record = await EmailOtp.findOne({ email });
      expect(record.verified).toBe(true);
    });

    it('rejects incorrect codes and decrements remaining attempts (max 5)', async () => {
      const email = `wrong.attempts.${Date.now()}@test.local`;
      await request(app).post('/api/auth/send-registration-otp').send({ email });

      // Attempt 1 with wrong code
      const res1 = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: '9999'
      });
      expect(res1.status).toBe(400);
      expect(res1.body.remainingAttempts).toBe(4);
      expect(res1.body.message).toContain('4 attempts remaining');

      // Attempt 2, 3, 4
      await request(app).post('/api/auth/verify-registration-otp').send({ email, otp: '1111' });
      await request(app).post('/api/auth/verify-registration-otp').send({ email, otp: '2222' });
      await request(app).post('/api/auth/verify-registration-otp').send({ email, otp: '3333' });

      // Attempt 5 (max exceeded)
      const res5 = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: '4444'
      });
      expect(res5.status).toBe(400);
      expect(res5.body.message).toMatch(/Maximum verification attempts exceeded/i);

      // Attempt 6: Even if correct code is supplied now, it is rejected because attempts >= 5
      const actualCode = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;
      const res6 = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: actualCode
      });
      expect(res6.status).toBe(400);
      expect(res6.body.message).toMatch(/Maximum verification attempts exceeded/i);
    });

    it('rejects expired codes (5-minute expiration)', async () => {
      const email = `expired.otp.${Date.now()}@test.local`;
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const actualCode = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;

      // Simulate expired code by updating expiresAt to past
      await EmailOtp.findOneAndUpdate(
        { email },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const res = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp: actualCode
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });
  });

  describe('3. Registration Security, Backend Verification & API Bypass Prevention', () => {
    it('prevents registration without verification: direct API call is rejected with 403', async () => {
      const unverifiedEmail = `direct.unverified.${Date.now()}@test.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Unverified',
        lastName: 'Hacker',
        email: unverifiedEmail,
        password: 'Password123!',
        role: 'worker'
      });

      expect(regRes.status).toBe(403);
      expect(regRes.body.success).toBe(false);
      expect(regRes.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(regRes.body.message).toMatch(/Email address has not been verified/i);

      // Account must NOT exist in database
      const user = await User.findOne({ email: unverifiedEmail });
      expect(user).toBeNull();
    });

    it('prevents API bypass attempts by trusting frontend emailVerified flag', async () => {
      const bypassEmail = `bypass.flag.${Date.now()}@test.local`;

      // Attacker attempts to forge emailVerified: true in JSON payload
      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Spoofer',
        lastName: 'Agent',
        email: bypassEmail,
        password: 'Password123!',
        role: 'worker',
        emailVerified: true
      });

      expect(regRes.status).toBe(403);
      expect(regRes.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');

      const user = await User.findOne({ email: bypassEmail });
      expect(user).toBeNull();
    });

    it('prevents using a verification token from a different email address', async () => {
      const email1 = `verified.victim.${Date.now()}@test.local`;
      const email2 = `attacker.${Date.now()}@test.local`;

      // Verify email1 legitimately
      await request(app).post('/api/auth/send-registration-otp').send({ email: email1 });
      const otp1 = _testEmailMock.getSentEmails().find((e) => e.to === email1).otp;
      const verifyRes = await request(app).post('/api/auth/verify-registration-otp').send({
        email: email1,
        otp: otp1
      });
      const validToken = verifyRes.body.verificationToken;

      // Try to register email2 using email1's verification token
      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Attacker',
        lastName: 'User',
        email: email2,
        password: 'Password123!',
        role: 'worker',
        verificationToken: validToken
      });

      expect(regRes.status).toBe(403);
      expect(regRes.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');

      const user2 = await User.findOne({ email: email2 });
      expect(user2).toBeNull();
    });

    it('successfully registers an account when verified via OTP, setting emailVerified: true immediately', async () => {
      const email = `legit.reg.${Date.now()}@test.local`;

      // 1. Send OTP
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const otp = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;

      // 2. Verify OTP
      const vRes = await request(app).post('/api/auth/verify-registration-otp').send({
        email,
        otp
      });
      expect(vRes.status).toBe(200);
      const verificationToken = vRes.body.verificationToken;

      // 3. Complete registration
      const regRes = await request(app).post('/api/auth/register').send({
        firstName: 'Elena',
        lastName: 'Rostova',
        email,
        password: 'Password123!',
        role: 'worker',
        verificationToken
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.user.emailVerified).toBe(true);
      expect(regRes.body.user.verificationStatus).toBe('verified');

      // Verify in DB
      const user = await User.findOne({ email });
      expect(user).not.toBeNull();
      expect(user.emailVerified).toBe(true);
      expect(user.verificationStatus).toBe('verified');

      // OTP session consumed and cleaned up
      const consumedOtp = await EmailOtp.findOne({ email });
      expect(consumedOtp).toBeNull();
    });

    it('single-use protection: cannot register a second account with the same consumed OTP session', async () => {
      const email = `singleuse.${Date.now()}@test.local`;

      // Verify OTP
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const otp = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;
      const vRes = await request(app).post('/api/auth/verify-registration-otp').send({ email, otp });
      const verificationToken = vRes.body.verificationToken;

      // Register first time succeeds
      const reg1 = await request(app).post('/api/auth/register').send({
        firstName: 'Single',
        lastName: 'Use',
        email,
        password: 'Password123!',
        role: 'worker',
        verificationToken
      });
      expect(reg1.status).toBe(201);

      // Replay attempt with same token is rejected
      const reg2 = await request(app).post('/api/auth/register').send({
        firstName: 'Replay',
        lastName: 'Attempt',
        email,
        password: 'Password123!',
        role: 'worker',
        verificationToken
      });
      expect(reg2.status).toBe(409); // Account already exists
    });
  });

  describe('4. Brevo Email Delivery Failures & Error Handling', () => {
    it('returns 502 gracefully when Brevo delivery fails, without creating partial state', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-mock-key';
      process.env.EMAIL_FROM = 'WorkMatch Security <verified@mycompany.com>';

      // Mock Brevo returning HTTP 500 error
      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Brevo service temporarily unavailable' })
      }));

      const email = `brevo.fail.${Date.now()}@test.local`;
      const res = await request(app).post('/api/auth/send-registration-otp').send({ email });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/couldn't deliver the verification code/i);

      // Ensure no registered user exists
      const user = await User.findOne({ email });
      expect(user).toBeNull();
    });

    it('dispatches OTP successfully via Brevo when API returns 201', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-mock-key';
      process.env.EMAIL_FROM = 'WorkMatch Security <verified@mycompany.com>';

      let brevoCalled = false;
      let sentSubject = '';
      let sentHtml = '';

      _testEmailMock.setBrevoFetch(async (url, options) => {
        brevoCalled = true;
        const parsed = JSON.parse(options.body);
        sentSubject = parsed.subject;
        sentHtml = parsed.htmlContent;
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: 'msg-brevo-otp-success' })
        };
      });

      const email = `brevo.success.${Date.now()}@test.local`;
      const res = await request(app).post('/api/auth/send-registration-otp').send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(brevoCalled).toBe(true);
      expect(sentSubject).toContain('Verification Code');
      expect(sentHtml).toContain('WorkMatch Security');
    });
  });

  describe('5. Existing Authentication & Login Compatibility', () => {
    it('registered user with verified email can log in immediately', async () => {
      const email = `login.compat.${Date.now()}@test.local`;
      const password = 'Password123!';

      // Verify OTP and register
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const otp = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;
      const vRes = await request(app).post('/api/auth/verify-registration-otp').send({ email, otp });
      await request(app).post('/api/auth/register').send({
        firstName: 'Login',
        lastName: 'Compatible',
        email,
        password,
        role: 'worker',
        verificationToken: vRes.body.verificationToken
      });

      // Login
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.user.emailVerified).toBe(true);
      expect(loginRes.body.user.firstName).toBe('Login');
      expect(loginRes.body.user.lastName).toBe('Compatible');
    });

    it('supports forgot password and password reset for OTP-registered accounts', async () => {
      const email = `pwd.compat.${Date.now()}@test.local`;
      const initialPassword = 'Password123!';
      const newPassword = 'NewSecurePassword456!';

      // Register account
      await request(app).post('/api/auth/send-registration-otp').send({ email });
      const otp = _testEmailMock.getSentEmails().find((e) => e.to === email).otp;
      const vRes = await request(app).post('/api/auth/verify-registration-otp').send({ email, otp });
      await request(app).post('/api/auth/register').send({
        firstName: 'Forgot',
        lastName: 'PasswordUser',
        email,
        password: initialPassword,
        role: 'worker',
        verificationToken: vRes.body.verificationToken
      });

      // Forgot password request
      const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.devResetToken).toBeDefined();

      // Reset password
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: forgotRes.body.devResetToken,
        newPassword
      });
      expect(resetRes.status).toBe(200);

      // Login with new password
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: newPassword
      });
      expect(loginRes.status).toBe(200);
    });
  });
});
