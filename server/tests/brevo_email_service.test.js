import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import {
  validateEmailConfig,
  parseEmailFrom,
  sendViaBrevo,
  sendVerificationEmail,
  sendPasswordResetEmail,
  _testEmailMock
} from '../src/services/emailService.js';

describe('Brevo Email Service & Integration Test Suite', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    _testEmailMock.resetBrevoFetch();
    _testEmailMock.resetResendClient();
    _testEmailMock.clearSentEmails();
    _testEmailMock.setSimulateFailure(false);
    delete process.env.BREVO_API_KEY;
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_PROVIDER = 'mock';
  });

  // =========================================================================
  // 1. Production Config Validation & Sender Parsing
  // =========================================================================
  describe('Email Configuration & Sender Parsing', () => {
    it('parseEmailFrom extracts name and email from RFC headers and fallback', () => {
      const full = parseEmailFrom('WorkMatch Security <sender@workmatch.app>');
      expect(full).toEqual({ name: 'WorkMatch Security', email: 'sender@workmatch.app' });

      const quoted = parseEmailFrom('"WorkMatch Alerts" <alerts@workmatch.app>');
      expect(quoted).toEqual({ name: 'WorkMatch Alerts', email: 'alerts@workmatch.app' });

      const emailOnly = parseEmailFrom('myemail@gmail.com');
      expect(emailOnly).toEqual({ name: 'WorkMatch Security', email: 'myemail@gmail.com' });

      const bracketOnly = parseEmailFrom('<myemail@gmail.com>');
      expect(bracketOnly).toEqual({ name: 'WorkMatch Security', email: 'myemail@gmail.com' });

      const empty = parseEmailFrom(null);
      expect(empty).toEqual({ name: 'WorkMatch Security', email: 'security@workmatch.app' });
    });

    it('validateEmailConfig enforces production guards for Brevo and Resend', () => {
      process.env.NODE_ENV = 'production';

      // Mock prohibited in production
      process.env.EMAIL_PROVIDER = 'mock';
      expect(() => validateEmailConfig()).toThrow(/Mock email fallback is prohibited/i);

      // Unknown provider prohibited
      process.env.EMAIL_PROVIDER = 'unknown_provider';
      expect(() => validateEmailConfig()).toThrow(/must be explicitly set to "resend" or "brevo"/i);

      // Brevo missing key
      process.env.EMAIL_PROVIDER = 'brevo';
      delete process.env.BREVO_API_KEY;
      expect(() => validateEmailConfig()).toThrow(/BREVO_API_KEY environment variable is missing/i);

      // Brevo valid key
      process.env.BREVO_API_KEY = 'xkeysib-valid-test-key';
      expect(() => validateEmailConfig()).not.toThrow();

      // Resend missing key
      process.env.EMAIL_PROVIDER = 'resend';
      delete process.env.RESEND_API_KEY;
      expect(() => validateEmailConfig()).toThrow(/RESEND_API_KEY environment variable is missing/i);

      // Resend valid key
      process.env.RESEND_API_KEY = 're_valid_test_key';
      expect(() => validateEmailConfig()).not.toThrow();

      process.env.NODE_ENV = 'test';
    });
  });

  // =========================================================================
  // 2. Direct Brevo HTTP API Dispatch Responses
  // =========================================================================
  describe('Brevo HTTP API Dispatch Unit Tests', () => {
    it('successfully handles HTTP 201 response with messageId', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-test-key';
      let capturedBody = null;

      _testEmailMock.setBrevoFetch(async (url, options) => {
        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(options.headers['api-key']).toBe('xkeysib-test-key');
        expect(options.headers['content-type']).toBe('application/json');
        capturedBody = JSON.parse(options.body);

        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<20261018.12345@smtp-relay.brevo.com>' })
        };
      });

      const result = await sendViaBrevo({
        to: 'recipient@example.com',
        senderName: 'WorkMatch Security',
        senderEmail: 'verified@domain.com',
        subject: 'Verify Email',
        htmlContent: '<p>Click here</p>',
        textContent: 'Click here',
        userName: 'John Doe'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<20261018.12345@smtp-relay.brevo.com>');
      expect(capturedBody.to[0].email).toBe('recipient@example.com');
      expect(capturedBody.sender.email).toBe('verified@domain.com');
    });

    it('handles HTTP 401 unauthorized (invalid API key)', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-invalid-key';

      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ code: 'unauthorized', message: 'Key not found' })
      }));

      const result = await sendViaBrevo({
        to: 'recipient@example.com',
        senderName: 'WorkMatch',
        senderEmail: 'verified@domain.com',
        subject: 'Test',
        htmlContent: 'Test',
        textContent: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Key not found');
    });

    it('handles HTTP 400 / 403 unapproved sender address error', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ code: 'invalid_parameter', message: 'Sender email is not authorized or verified' })
      }));

      const result = await sendViaBrevo({
        to: 'recipient@example.com',
        senderName: 'WorkMatch',
        senderEmail: 'unverified@random.com',
        subject: 'Test',
        htmlContent: 'Test',
        textContent: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Sender email is not authorized');
    });

    it('handles HTTP 429 rate limit or temporary provider error', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ code: 'rate_limited', message: 'Hourly email quota exceeded' })
      }));

      const result = await sendViaBrevo({
        to: 'recipient@example.com',
        senderName: 'WorkMatch',
        senderEmail: 'verified@domain.com',
        subject: 'Test',
        htmlContent: 'Test',
        textContent: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.error).toContain('Hourly email quota exceeded');
    });

    it('handles network exception during dispatch without crashing', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      _testEmailMock.setBrevoFetch(async () => {
        throw new Error('ECONNRESET connection reset by peer');
      });

      const result = await sendViaBrevo({
        to: 'recipient@example.com',
        senderName: 'WorkMatch',
        senderEmail: 'verified@domain.com',
        subject: 'Test',
        htmlContent: 'Test',
        textContent: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNRESET');
    });
  });

  // =========================================================================
  // 3. Authentication Flows with Brevo Delivery
  // =========================================================================
  describe('Authentication Flows with Brevo Provider Active', () => {
    it('Registration: dispatches verification email via Brevo and NEVER leaks devVerificationToken', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-key';
      process.env.EMAIL_FROM = 'WorkMatch Security <verified@mycompany.com>';

      let brevoCalled = false;
      _testEmailMock.setBrevoFetch(async (url, options) => {
        brevoCalled = true;
        const body = JSON.parse(options.body);
        expect(body.sender.email).toBe('verified@mycompany.com');
        expect(body.subject).toContain('Verify Your Email Address');
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: 'msg-brevo-reg-1' })
        };
      });

      const email = `brevo.reg.${Date.now()}@test.local`;
      const res = await request(app).post('/api/auth/register').send({
        name: 'Brevo User',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.emailSent).toBe(true);
      expect(res.body.message).toContain('Verification email sent');
      expect(res.body.devVerificationToken).toBeUndefined(); // NEVER leaked when live provider active
      expect(brevoCalled).toBe(true);
    });

    it('Registration: correctly informs user if Brevo dispatch fails without failing account creation', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Account unactivated or suspended' })
      }));

      const email = `brevo.fail.${Date.now()}@test.local`;
      const res = await request(app).post('/api/auth/register').send({
        name: 'Brevo Fail User',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.message).toContain("couldn't send your verification email");
      expect(res.body.devVerificationToken).toBeUndefined();
    });

    it('Resend Verification: dispatches via Brevo and returns 502 if Brevo fails', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      // Create unverified user
      const email = `brevo.resend.${Date.now()}@test.local`;
      _testEmailMock.setBrevoFetch(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'ok' })
      }));

      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Resend Test User',
        email,
        password: 'Password123!',
        role: 'worker'
      });
      const token = regRes.body.token;

      // Now simulate Brevo failure on resend-verification
      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Brevo service degraded' })
      }));

      const resendRes = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ email });

      expect(resendRes.status).toBe(502);
      expect(resendRes.body.success).toBe(false);
      expect(resendRes.body.message).toContain("couldn't send your verification email");

      // Now simulate Brevo success on resend-verification
      _testEmailMock.setBrevoFetch(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'msg-brevo-resend-success' })
      }));

      const resendSuccessRes = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ email });

      expect(resendSuccessRes.status).toBe(200);
      expect(resendSuccessRes.body.success).toBe(true);
    });

    it('Password Reset: dispatches via Brevo, returns 502 on delivery failure, and never leaks devResetToken', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-key';

      const email = `brevo.pwd.${Date.now()}@test.local`;
      _testEmailMock.setBrevoFetch(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'ok' })
      }));

      await request(app).post('/api/auth/register').send({
        name: 'Pwd Reset User',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      // 1. Successful forgot-password dispatch
      let resetBrevoCalled = false;
      _testEmailMock.setBrevoFetch(async (url, options) => {
        resetBrevoCalled = true;
        const body = JSON.parse(options.body);
        expect(body.subject).toContain('Password Reset Request');
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: 'msg-brevo-pwd-1' })
        };
      });

      const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.devResetToken).toBeUndefined(); // NEVER leaked
      expect(resetBrevoCalled).toBe(true);

      // 2. Failed forgot-password dispatch safely handles delivery failure without crashing or leaking account status
      _testEmailMock.setBrevoFetch(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' })
      }));

      const forgotFailRes = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(forgotFailRes.status).toBe(200);
      expect(forgotFailRes.body.success).toBe(true);
      expect(forgotFailRes.body.emailSent).toBe(false);
      expect(forgotFailRes.body.message).toContain('Password reset instructions have been requested');
      expect(forgotFailRes.body.devResetToken).toBeUndefined();
    });
  });
});
