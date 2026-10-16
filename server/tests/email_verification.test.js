import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { _testEmailMock } from '../src/services/emailService.js';
import { _setTestVerificationLimit, _resetVerificationRateLimiter } from '../src/middleware/rateLimiters.js';
import { ROLES, JOB_STATUSES } from '../src/config/constants.js';

describe('Mandatory Email Verification Test Suite', () => {
  let verifiedEmployerToken, verifiedEmployerId;
  let unverifiedEmployerToken, unverifiedEmployerId;
  let verifiedWorkerToken, verifiedWorkerId;
  let unverifiedWorkerToken, unverifiedWorkerId;
  let testJobId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();

    // 1. Create a Verified Employer
    const veRes = await request(app).post('/api/auth/register').send({
      name: 'Verified Apex Employer',
      email: `verified.emp.${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      role: 'employer',
      businessName: 'Apex Verified Logistics'
    });
    verifiedEmployerToken = veRes.body.token;
    verifiedEmployerId = veRes.body.user.id;
    await User.findByIdAndUpdate(verifiedEmployerId, { emailVerified: true });

    // 2. Create an Unverified Employer
    const ueRes = await request(app).post('/api/auth/register').send({
      name: 'Unverified Employer',
      email: `unverified.emp.${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      role: 'employer',
      businessName: 'Unverified Start LLC'
    });
    unverifiedEmployerToken = ueRes.body.token;
    unverifiedEmployerId = ueRes.body.user.id;

    // 3. Create a Verified Worker
    const vwRes = await request(app).post('/api/auth/register').send({
      name: 'Verified Shift Worker',
      email: `verified.worker.${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      role: 'worker'
    });
    verifiedWorkerToken = vwRes.body.token;
    verifiedWorkerId = vwRes.body.user.id;
    await User.findByIdAndUpdate(verifiedWorkerId, { emailVerified: true });

    // 4. Create an Unverified Worker
    const uwRes = await request(app).post('/api/auth/register').send({
      name: 'Unverified Shift Worker',
      email: `unverified.worker.${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      role: 'worker'
    });
    unverifiedWorkerToken = uwRes.body.token;
    unverifiedWorkerId = uwRes.body.user.id;

    // 5. Post a legitimate job by the Verified Employer for application testing
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${verifiedEmployerToken}`)
      .send({
        title: 'Email Verification Test Shift',
        description: 'Temporary warehouse packing and staging shift',
        category: 'Warehouse and packing',
        locationName: 'Central Logistics Hub',
        coordinates: [-73.985, 40.748],
        workDate: tomorrow.toISOString(),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        openings: 5,
        requiredSkills: ['Packing', 'Punctuality'],
        grossPay: 28,
        payBasis: 'hourly'
      });

    testJobId = jobRes.body.job._id;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    _testEmailMock.clearSentEmails();
    _testEmailMock.setSimulateFailure(false);
  });

  // =========================================================================
  // REQUIREMENT 1: WORKER EMAIL VERIFICATION BEFORE APPLYING
  // =========================================================================
  describe('Requirement 1: Worker Verification Before Applying', () => {
    it('Unverified worker CANNOT apply: returns 403 with code EMAIL_VERIFICATION_REQUIRED', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${unverifiedWorkerToken}`)
        .send({ message: 'I want to apply despite not verifying' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(res.body.message).toMatch(/Email verification is required/i);
    });

    it('Verified worker CAN apply normally when all other rules pass', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${verifiedWorkerToken}`)
        .send({ message: 'I am verified and eager to work this shift' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application).toBeDefined();
      expect(res.body.application.status).toBe('APPLIED');
    });
  });

  // =========================================================================
  // REQUIREMENT 2: EMPLOYER EMAIL VERIFICATION BEFORE POSTING/PUBLISHING JOBS
  // =========================================================================
  describe('Requirement 2: Employer Verification Before Posting Jobs', () => {
    it('Unverified employer CANNOT create a job: returns 403 with code EMAIL_VERIFICATION_REQUIRED', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 4);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${unverifiedEmployerToken}`)
        .send({
          title: 'Unverified Job Attempt',
          description: 'This job should be blocked at the endpoint',
          category: 'Retail and store assistance',
          locationName: 'Midtown Shop',
          coordinates: [-73.985, 40.748],
          workDate: tomorrow.toISOString(),
          startTime: '10:00',
          endTime: '18:00',
          totalHours: 8,
          openings: 2,
          grossPay: 22,
          payBasis: 'hourly'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(res.body.message).toMatch(/Email verification is required/i);
    });

    it('Verified employer CAN create jobs normally', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${verifiedEmployerToken}`)
        .send({
          title: 'Verified Employer Job Listing',
          description: 'Legitimate job created by verified employer',
          category: 'Retail and store assistance',
          locationName: 'Downtown Store',
          coordinates: [-73.985, 40.748],
          workDate: tomorrow.toISOString(),
          startTime: '10:00',
          endTime: '18:00',
          totalHours: 8,
          openings: 2,
          grossPay: 25,
          payBasis: 'hourly'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.title).toBe('Verified Employer Job Listing');
    });

    it('Unverified employer CANNOT edit or publish an existing job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${unverifiedEmployerToken}`)
        .send({ title: 'Hacked Title Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: SECURE TOKEN GENERATION, STORAGE, EXPIRY, AND SINGLE-USE
  // =========================================================================
  describe('Requirement 3: Secure Verification Token Flow', () => {
    let testUserEmail;
    let rawVerificationToken;

    it('Registration generates cryptographically secure token, stores only SHA-256 hash in DB, and dispatches email', async () => {
      testUserEmail = `token.flow.${Date.now()}@test.local`;

      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Token Flow User',
        email: testUserEmail,
        password: 'Password123!',
        role: 'worker'
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.user.emailVerified).toBe(false);

      // Verify DB record: raw token must NOT be stored
      const dbUser = await User.findOne({ email: testUserEmail });
      expect(dbUser.emailVerified).toBe(false);
      expect(dbUser.emailVerificationToken).toBeDefined();
      expect(dbUser.emailVerificationExpires).toBeDefined();
      expect(dbUser.emailVerificationExpires.getTime()).toBeGreaterThan(Date.now());

      // Check email sent via Resend mock
      const sentEmails = _testEmailMock.getSentEmails();
      expect(sentEmails.length).toBeGreaterThan(0);
      const email = sentEmails.find((e) => e.to === testUserEmail);
      expect(email).toBeDefined();
      expect(email.type).toBe('verification');
      expect(email.verifyUrl).toMatch(/\/verify-email\?token=/);

      // Extract raw token from link
      const match = email.verifyUrl.match(/token=([a-f0-9]+)/);
      expect(match).not.toBeNull();
      rawVerificationToken = match[1];

      // Cryptographic check: DB token must be sha256(rawVerificationToken)
      const expectedHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
      expect(dbUser.emailVerificationToken).toBe(expectedHash);
    });

    it('Valid token successfully verifies email and is single-use', async () => {
      // 1. First verification with valid token
      const verifyRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: rawVerificationToken });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // Verify DB state
      const dbUser = await User.findOne({ email: testUserEmail });
      expect(dbUser.emailVerified).toBe(true);
      expect(dbUser.emailVerificationToken).toBeUndefined();
      expect(dbUser.emailVerificationExpires).toBeUndefined();

      // 2. Token reuse MUST be rejected
      const reuseRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: rawVerificationToken });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.message).toMatch(/invalid or has expired/i);
    });

    it('Invalid token format or non-existent token is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'definitelynotarealtoken1234567890abcdef' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it('Expired verification token is rejected', async () => {
      const expiredEmail = `expired.${Date.now()}@test.local`;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.create({
        name: 'Expired Token User',
        email: expiredEmail,
        passwordHash: 'somehashedpass',
        role: 'worker',
        emailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: RESEND VERIFICATION & ACCOUNT ENUMERATION PREVENTION
  // =========================================================================
  describe('Requirement 4: Resend Verification & Security', () => {
    it('Resend verification sends new token and returns generic message for unverified account', async () => {
      const email = `resend.unverified.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Resend Candidate',
        email,
        password: 'Password123!',
        role: 'worker'
      });
      _testEmailMock.clearSentEmails();

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/verification instructions have been dispatched/i);

      const sentEmails = _testEmailMock.getSentEmails();
      expect(sentEmails.some((e) => e.to === email)).toBe(true);
    });

    it('Does NOT leak account existence: non-existent email returns identical generic message', async () => {
      const nonExistentEmail = `doesnotexist.${Date.now()}@nonexistent.domain.local`;

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: nonExistentEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/verification instructions have been dispatched/i);

      // No email should be sent for non-existent account
      const sentEmails = _testEmailMock.getSentEmails();
      expect(sentEmails.some((e) => e.to === nonExistentEmail)).toBe(false);
    });

    it('Does NOT leak account existence: unauthenticated caller requesting verified email receives identical generic message', async () => {
      const verifiedUserEmail = `already.verified.${Date.now()}@test.local`;
      await User.create({
        name: 'Already Verified Probe Target',
        email: verifiedUserEmail,
        passwordHash: 'dummyhash',
        role: 'worker',
        emailVerified: true
      });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: verifiedUserEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/verification instructions have been dispatched/i);
    });

    it('Authenticated user requesting resend when already verified receives informative notice', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${verifiedWorkerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/already verified/i);
    });

    it('Resend verification endpoint is rate-limited: rejects excessive requests with 429', async () => {
      _resetVerificationRateLimiter();
      _setTestVerificationLimit(2);
      const email = `ratelimit.user.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Rate Limit Candidate',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      // Request 1: OK
      const r1 = await request(app).post('/api/auth/resend-verification').send({ email });
      expect(r1.status).toBe(200);

      // Request 2: OK
      const r2 = await request(app).post('/api/auth/resend-verification').send({ email });
      expect(r2.status).toBe(200);

      // Request 3: Exceeded limit -> 429
      const r3 = await request(app).post('/api/auth/resend-verification').send({ email });
      expect(r3.status).toBe(429);
      expect(r3.body.message).toMatch(/too many verification requests/i);

      // Reset test override
      _setTestVerificationLimit(null);
    });
  });

  // =========================================================================
  // REQUIREMENT 5: CLIENT TAMPER RESISTANCE & FRESH DATABASE ENFORCEMENT
  // =========================================================================
  describe('Requirement 5: Authorization & Tamper Resistance', () => {
    it('Client CANNOT bypass verification by setting emailVerified: true in registration body', async () => {
      const tamperEmail = `tamper.reg.${Date.now()}@test.local`;

      const res = await request(app).post('/api/auth/register').send({
        name: 'Tamper Attacker',
        email: tamperEmail,
        password: 'Password123!',
        role: 'worker',
        emailVerified: true // Attacker injects true
      });

      expect(res.status).toBe(201);
      expect(res.body.user.emailVerified).toBe(false);

      const dbUser = await User.findOne({ email: tamperEmail });
      expect(dbUser.emailVerified).toBe(false);
    });

    it('Client CANNOT set emailVerified: true through worker profile updates', async () => {
      const res = await request(app)
        .patch('/api/workers/me')
        .set('Authorization', `Bearer ${unverifiedWorkerToken}`)
        .send({
          emailVerified: true,
          skills: ['Hacking']
        });

      expect(res.status).toBe(200);

      // Verify DB record is untouched
      const dbUser = await User.findById(unverifiedWorkerId);
      expect(dbUser.emailVerified).toBe(false);
    });

    it('Database record is authoritative: unverified user cannot apply even if client manipulates headers or body', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${unverifiedWorkerToken}`)
        .send({
          emailVerified: true,
          user: { emailVerified: true },
          message: 'Trying to bypass with payload injection'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });
  });
});
