import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { _testEmailMock, sendPasswordResetEmail, validateEmailConfig } from '../src/services/emailService.js';
import { getShiftInterval, shiftsOverlap, isValidTimeString } from '../src/utils/scheduleUtils.js';
import { getRateLimiterTopology } from '../src/middleware/rateLimiters.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ASSIGNMENT_STATUSES } from '../src/config/constants.js';

describe('Production Blocker Fixes & Regression Test Suite', () => {
  let employerToken, employerId;
  let workerToken, workerId;
  let worker2Token, worker2Id;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();

    // Register Employer
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Blocker Fix Employer',
      email: `emp.fix.${Date.now()}@test.local`,
      password: 'StrongPassword123!',
      role: 'employer',
      businessName: 'Apex Event Logistics'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;

    // Register Worker 1
    const w1Res = await request(app).post('/api/auth/register').send({
      name: 'Blocker Fix Worker 1',
      email: `w1.fix.${Date.now()}@test.local`,
      password: 'StrongPassword123!',
      role: 'worker'
    });
    workerToken = w1Res.body.token;
    workerId = w1Res.body.user.id;

    // Register Worker 2
    const w2Res = await request(app).post('/api/auth/register').send({
      name: 'Blocker Fix Worker 2',
      email: `w2.fix.${Date.now()}@test.local`,
      password: 'StrongPassword123!',
      role: 'worker'
    });
    worker2Token = w2Res.body.token;
    worker2Id = w2Res.body.user.id;

    // Verify test accounts so standard application & scheduling tests can proceed
    await User.updateMany(
      { _id: { $in: [employerId, workerId, worker2Id] } },
      { $set: { emailVerified: true } }
    );
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    _testEmailMock.clearSentEmails();
    _testEmailMock.setSimulateFailure(false);
    _testEmailMock.resetResendClient();
    process.env.NODE_ENV = 'test';
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
  });

  // =========================================================================
  // FIX 1: PASSWORD-RESET EMAIL DELIVERY REGRESSION TESTS
  // =========================================================================
  describe('Fix 1: Password-Reset Email Delivery & Security', () => {
    it('dispatches password-reset email with raw token to registered email and stores hashed token in DB', async () => {
      const email = `reset.user.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Reset Test User',
        email,
        password: 'OriginalPassword123!',
        role: 'worker'
      });

      _testEmailMock.clearSentEmails();

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password recovery instructions have been sent');

      // Verify email was received by emailService mock
      const sentEmails = _testEmailMock.getSentEmails();
      expect(sentEmails.length).toBe(1);
      const emailObj = sentEmails[0];
      expect(emailObj.to).toBe(email);
      expect(emailObj.resetUrl).toContain('/reset-password?token=');

      // Verify DB contains only hashed token, NOT the raw token
      const rawTokenFromEmail = new URL(emailObj.resetUrl).searchParams.get('token');
      expect(rawTokenFromEmail).toBeDefined();

      const userInDb = await User.findOne({ email });
      expect(userInDb.resetPasswordToken).toBeDefined();
      expect(userInDb.resetPasswordToken).not.toBe(rawTokenFromEmail); // Must be hashed!
      expect(userInDb.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns generic response for unknown email without sending an email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent.user.999@test.local' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password recovery instructions have been sent');

      const sentEmails = _testEmailMock.getSentEmails();
      expect(sentEmails.length).toBe(0); // Zero emails sent
    });

    it('handles email transport failures safely without crashing or exposing account status', async () => {
      const email = `fail.user.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Fail User',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      _testEmailMock.setSimulateFailure(true);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password recovery instructions have been sent');
    });

    it('enforces single-use tokens: token cannot be reused after successful password reset', async () => {
      const email = `singleuse.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Single Use User',
        email,
        password: 'OriginalPassword123!',
        role: 'worker'
      });

      await request(app).post('/api/auth/forgot-password').send({ email });
      const sentEmail = _testEmailMock.getLastEmail();
      const token = new URL(sentEmail.resetUrl).searchParams.get('token');

      // First reset: must succeed
      const resetRes1 = await request(app).post('/api/auth/reset-password').send({
        token,
        newPassword: 'BrandNewPassword123!'
      });
      expect(resetRes1.status).toBe(200);
      expect(resetRes1.body.success).toBe(true);

      // Second reset with SAME token: must fail (token cleared)
      const resetRes2 = await request(app).post('/api/auth/reset-password').send({
        token,
        newPassword: 'AnotherPassword123!'
      });
      expect(resetRes2.status).toBe(400);
      expect(resetRes2.body.message).toMatch(/invalid or has expired/i);
    });

    it('rejects expired password-reset tokens', async () => {
      const email = `expired.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'Expired Token User',
        email,
        password: 'OriginalPassword123!',
        role: 'worker'
      });

      await request(app).post('/api/auth/forgot-password').send({ email });
      const sentEmail = _testEmailMock.getLastEmail();
      const token = new URL(sentEmail.resetUrl).searchParams.get('token');

      // Manually backdate expiration to 1 hour ago
      await User.updateOne({ email }, { resetPasswordExpires: new Date(Date.now() - 3600000) });

      const res = await request(app).post('/api/auth/reset-password').send({
        token,
        newPassword: 'BrandNewPassword123!'
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it('invalidates prior active JWT sessions after password reset', async () => {
      const email = `revocation.${Date.now()}@test.local`;
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Revocation User',
        email,
        password: 'OriginalPassword123!',
        role: 'worker'
      });
      const oldToken = regRes.body.token;

      // Verify old token works before reset
      const check1 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
      expect(check1.status).toBe(200);

      // Request and complete reset
      await request(app).post('/api/auth/forgot-password').send({ email });
      const token = new URL(_testEmailMock.getLastEmail().resetUrl).searchParams.get('token');
      await request(app).post('/api/auth/reset-password').send({
        token,
        newPassword: 'BrandNewPassword123!'
      });

      // Old token MUST now be rejected with 401
      const check2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
      expect(check2.status).toBe(401);
      expect(check2.body.message).toMatch(/Password was recently changed/i);
    });

    it('Resend SDK: dispatches email via Resend client with correct headers, sender, recipient, and URL', async () => {
      let dispatchedPayload = null;
      const mockResend = {
        emails: {
          send: async (payload) => {
            dispatchedPayload = payload;
            return { data: { id: 're_msg_mock_999' }, error: null };
          }
        }
      };

      _testEmailMock.setResendClient(mockResend);
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 're_test_key_123';
      process.env.CLIENT_URL = 'https://workmatch.app';

      const result = await sendPasswordResetEmail({
        to: 'candidate@workmatch.app',
        resetToken: 'secure_random_token_abc123',
        userName: 'Alex Rivera'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('re_msg_mock_999');
      expect(dispatchedPayload).toBeDefined();
      expect(dispatchedPayload.from).toBe('WorkMatch Security <security@workmatch.app>');
      expect(dispatchedPayload.to).toEqual(['candidate@workmatch.app']);
      expect(dispatchedPayload.subject).toBe('WorkMatch — Password Reset Request');
      expect(dispatchedPayload.html).toContain('https://workmatch.app/reset-password?token=secure_random_token_abc123');
      expect(dispatchedPayload.text).toContain('https://workmatch.app/reset-password?token=secure_random_token_abc123');
    });

    it('Resend SDK: handles provider API errors safely without leaking sensitive information', async () => {
      const mockResend = {
        emails: {
          send: async () => {
            return { data: null, error: { message: 'Domain workmatch.app is not verified on Resend', name: 'validation_error' } };
          }
        }
      };

      _testEmailMock.setResendClient(mockResend);
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 're_test_key_123';

      const result = await sendPasswordResetEmail({
        to: 'candidate@workmatch.app',
        resetToken: 'token_xyz',
        userName: 'Alex Rivera'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain workmatch.app is not verified');
    });

    it('Security Invariant: API responses NEVER leak devResetToken when EMAIL_PROVIDER=resend or in production', async () => {
      const email = `no.leak.${Date.now()}@test.local`;
      await request(app).post('/api/auth/register').send({
        name: 'No Leak User',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      // Configure resend provider
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 're_test_key';
      _testEmailMock.setResendClient({
        emails: { send: async () => ({ data: { id: 'ok' }, error: null }) }
      });

      const res = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.devResetToken).toBeUndefined(); // MUST NOT leak token
    });

    it('Production Guard: validateEmailConfig strictly prohibits mock email and missing RESEND_API_KEY in production', () => {
      // In production with EMAIL_PROVIDER=mock: MUST throw
      process.env.NODE_ENV = 'production';
      process.env.EMAIL_PROVIDER = 'mock';
      expect(() => validateEmailConfig()).toThrow(/Mock email fallback is prohibited/i);

      // In production with EMAIL_PROVIDER=resend but missing RESEND_API_KEY: MUST throw
      process.env.EMAIL_PROVIDER = 'resend';
      delete process.env.RESEND_API_KEY;
      expect(() => validateEmailConfig()).toThrow(/RESEND_API_KEY environment variable is missing/i);

      // In production with valid RESEND_API_KEY: MUST NOT throw
      process.env.RESEND_API_KEY = 're_prod_valid_key_12345';
      expect(() => validateEmailConfig()).not.toThrow();
    });
  });

  // =========================================================================
  // FIX 2: ATOMIC HIRING AND JOB CAPACITY REGRESSION TESTS
  // =========================================================================
  describe('Fix 2: Atomic Hiring & Job Capacity Concurrency Protection', () => {
    it('handles at least 5 concurrent hiring requests for the same applicant: exactly 1 succeeds, others return 409', async () => {
      // Create job with 2 openings
      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Concurrent Race Test Job',
          description: 'Testing high-concurrency hiring invariance',
          category: 'Wedding and catering support',
          openings: 2,
          locationName: 'Convention Center West',
          coordinates: [-122.4194, 37.7749],
          workDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          startTime: '10:00',
          endTime: '16:00',
          totalHours: 6,
          grossPay: 180
        });
      expect(jobRes.status).toBe(201);
      const jobId = jobRes.body.job._id;

      // Worker 1 applies
      const appRes = await request(app)
        .post(`/api/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying for race test' });
      expect(appRes.status).toBe(201);
      const applicationId = appRes.body.application._id;

      // Fire 5 concurrent requests to hire the exact same applicant
      const concurrentHireRequests = Array.from({ length: 5 }, () =>
        request(app)
          .patch(`/api/applications/${applicationId}/status`)
          .set('Authorization', `Bearer ${employerToken}`)
          .send({ status: APPLICATION_STATUSES.HIRED, note: 'Simultaneous hiring click' })
      );

      const responses = await Promise.all(concurrentHireRequests);
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 409);

      // Exactly ONE request must succeed with 200, four must fail with 409
      expect(successResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(4);

      // Exactly ONE Assignment must exist for this job and worker
      const assignments = await Assignment.find({ job: jobId, worker: workerId });
      expect(assignments.length).toBe(1);

      // Exactly ONE PaymentRecord must exist
      const payments = await PaymentRecord.find({ job: jobId, worker: workerId });
      expect(payments.length).toBe(1);

      // filledCount must be exactly 1
      const jobInDb = await Job.findById(jobId);
      expect(jobInDb.filledCount).toBe(1);
    });

    it('competing applicants for a job with 1 opening: exactly 1 gets hired, second receives 409 capacity reached', async () => {
      // Job with openings = 1
      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Single Slot Competing Job',
          description: 'Testing competing applicants for single opening',
          category: 'Warehouse and packing',
          openings: 1,
          locationName: 'North Pier Dock',
          coordinates: [-122.4194, 37.7749],
          workDate: new Date(Date.now() + 86400000 * 6).toISOString(),
          startTime: '08:00',
          endTime: '12:00',
          totalHours: 4,
          grossPay: 100
        });
      expect(jobRes.status).toBe(201);
      const jobId = jobRes.body.job._id;

      // Worker 1 and Worker 2 apply
      const app1Res = await request(app)
        .post(`/api/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Worker 1 applying' });

      const app2Res = await request(app)
        .post(`/api/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ message: 'Worker 2 applying' });

      const app1Id = app1Res.body.application._id;
      const app2Id = app2Res.body.application._id;

      // Employer attempts to hire both concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/applications/${app1Id}/status`)
          .set('Authorization', `Bearer ${employerToken}`)
          .send({ status: APPLICATION_STATUSES.HIRED }),
        request(app)
          .patch(`/api/applications/${app2Id}/status`)
          .set('Authorization', `Bearer ${employerToken}`)
          .send({ status: APPLICATION_STATUSES.HIRED })
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Verify job filledCount is exactly 1 and status is FILLED
      const jobAfter = await Job.findById(jobId);
      expect(jobAfter.filledCount).toBe(1);
      expect(jobAfter.status).toBe(JOB_STATUSES.FILLED);

      // Exactly 1 assignment created total
      const totalAssignments = await Assignment.find({ job: jobId });
      expect(totalAssignments.length).toBe(1);
    });

    it('enforces compound uniqueness on Assignment: same worker cannot be assigned twice for same job', async () => {
      const job = await Job.create({
        employer: employerId,
        title: 'Duplicate Index Enforcement Job',
        description: 'Test job description',
        category: 'Retail and store assistance',
        openings: 3,
        locationName: 'Test Venue',
        location: { type: 'Point', coordinates: [-122.4, 37.7] },
        workDate: new Date(Date.now() + 86400000 * 7),
        applicationDeadline: new Date(Date.now() + 86400000 * 6),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 200
      });

      const app1 = await Application.create({
        job: job._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      // First assignment succeeds
      await Assignment.create({
        job: job._id,
        worker: workerId,
        employer: employerId,
        application: app1._id,
        agreedSchedule: {
          workDate: job.workDate,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8
        },
        agreedPayment: { grossAmount: 200, currency: 'USD', basis: 'hourly' },
        status: ASSIGNMENT_STATUSES.CONFIRMED
      });

      // Second assignment attempt for SAME job and worker must throw duplicate key error (code 11000)
      let duplicateError;
      try {
        await Assignment.create({
          job: job._id,
          worker: workerId,
          employer: employerId,
          application: app1._id,
          agreedSchedule: {
            workDate: job.workDate,
            startTime: '09:00',
            endTime: '17:00',
            totalHours: 8
          },
          agreedPayment: { grossAmount: 200, currency: 'USD', basis: 'hourly' },
          status: ASSIGNMENT_STATUSES.CONFIRMED
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000);
    });
  });

  // =========================================================================
  // FIX 3: ACCURATE SHIFT-OVERLAP DETECTION REGRESSION TESTS
  // =========================================================================
  describe('Fix 3: Accurate Shift-Overlap Math & Boundary Policy', () => {
    const testDate = '2026-11-20T00:00:00.000Z';

    it('Case 1: Existing 09:00–13:00; new 12:00–16:00 MUST overlap (reject with conflict)', () => {
      const existing = getShiftInterval(testDate, '09:00', '13:00');
      const incoming = getShiftInterval(testDate, '12:00', '16:00');
      expect(shiftsOverlap(existing, incoming)).toBe(true);
    });

    it('Case 2: Existing 09:00–13:00; new 13:00–17:00 (back-to-back) MUST NOT overlap (allow)', () => {
      const existing = getShiftInterval(testDate, '09:00', '13:00');
      const incoming = getShiftInterval(testDate, '13:00', '17:00');
      expect(shiftsOverlap(existing, incoming)).toBe(false);
    });

    it('Case 3: Existing 09:00–13:00; new 14:00–18:00 (separated by gap) MUST NOT overlap (allow)', () => {
      const existing = getShiftInterval(testDate, '09:00', '13:00');
      const incoming = getShiftInterval(testDate, '14:00', '18:00');
      expect(shiftsOverlap(existing, incoming)).toBe(false);
    });

    it('Case 4: Shifts on different dates MUST NOT overlap unless crossing midnight', () => {
      const day1 = getShiftInterval('2026-11-20T00:00:00.000Z', '09:00', '13:00');
      const day2 = getShiftInterval('2026-11-21T00:00:00.000Z', '09:00', '13:00');
      expect(shiftsOverlap(day1, day2)).toBe(false);
    });

    it('Case 5: Overnight shift 22:00–06:00 overlapping next-morning shift 05:00–09:00 MUST overlap (reject)', () => {
      const overnightShift = getShiftInterval('2026-11-20T00:00:00.000Z', '22:00', '06:00');
      expect(overnightShift.isOvernight).toBe(true);
      expect(overnightShift.durationHours).toBe(8);

      const morningShift = getShiftInterval('2026-11-21T00:00:00.000Z', '05:00', '09:00');
      expect(shiftsOverlap(overnightShift, morningShift)).toBe(true);
    });

    it('Case 6: Validates time format and rejects invalid or missing times', () => {
      expect(isValidTimeString('09:00')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('24:00')).toBe(false);
      expect(isValidTimeString('9:00')).toBe(false);
      expect(isValidTimeString('invalid')).toBe(false);
      expect(isValidTimeString(null)).toBe(false);

      expect(() => getShiftInterval(testDate, 'invalid', '17:00')).toThrow(/Invalid startTime format/);
    });

    it('API Integration: Worker with confirmed shift 09:00–13:00 applying for 14:00–18:00 on SAME date is ALLOWED', async () => {
      const shiftDate = new Date(Date.now() + 86400000 * 10).toISOString();

      // Create Shift 1 (09:00 - 13:00)
      const job1Res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Morning Shift 09-13',
          description: 'Morning banquet service',
          category: 'Wedding and catering support',
          openings: 1,
          locationName: 'Hall A',
          coordinates: [-122.4, 37.7],
          workDate: shiftDate,
          startTime: '09:00',
          endTime: '13:00',
          totalHours: 4,
          grossPay: 100
        });
      expect(job1Res.status).toBe(201);
      const job1Id = job1Res.body.job._id;

      // Worker 1 applies and gets HIRED for Shift 1
      const app1 = await request(app)
        .post(`/api/jobs/${job1Id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying morning' });
      expect(app1.status).toBe(201);

      const hireRes = await request(app)
        .patch(`/api/applications/${app1.body.application._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: APPLICATION_STATUSES.HIRED });
      expect(hireRes.status).toBe(200);

      // Create Shift 2 (14:00 - 18:00) on the EXACT SAME calendar date
      const job2Res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Afternoon Shift 14-18',
          description: 'Afternoon banquet service',
          category: 'Wedding and catering support',
          openings: 1,
          locationName: 'Hall B',
          coordinates: [-122.4, 37.7],
          workDate: shiftDate,
          startTime: '14:00',
          endTime: '18:00',
          totalHours: 4,
          grossPay: 100
        });
      expect(job2Res.status).toBe(201);
      const job2Id = job2Res.body.job._id;

      // Applying to non-overlapping shift on SAME day MUST SUCCEED (201)
      const app2Res = await request(app)
        .post(`/api/jobs/${job2Id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying afternoon' });

      expect(app2Res.status).toBe(201);
      expect(app2Res.body.success).toBe(true);

      // Now create Shift 3 (12:00 - 16:00) overlapping both shifts: Applying MUST BE REJECTED with 409
      const job3Res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Overlapping Shift 12-16',
          description: 'Midday overlap service',
          category: 'Wedding and catering support',
          openings: 1,
          locationName: 'Hall C',
          coordinates: [-122.4, 37.7],
          workDate: shiftDate,
          startTime: '12:00',
          endTime: '16:00',
          totalHours: 4,
          grossPay: 100
        });
      expect(job3Res.status).toBe(201);
      const job3Id = job3Res.body.job._id;

      const app3Res = await request(app)
        .post(`/api/jobs/${job3Id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying overlapping' });

      expect(app3Res.status).toBe(409);
      expect(app3Res.body.message).toMatch(/Schedule conflict/i);
    });
  });

  // =========================================================================
  // FIX 4: SHARED RATE LIMITING TOPOLOGY REGRESSION TESTS
  // =========================================================================
  describe('Fix 4: Shared Rate Limiting Configuration & Topology', () => {
    it('reports correct rate limiter topology metadata', () => {
      const topology = getRateLimiterTopology();
      expect(topology).toBeDefined();
      expect(['memory', 'redis']).toContain(topology.storeType);
      expect(topology.proxyTrust).toBe('single-hop');
    });
  });
});
