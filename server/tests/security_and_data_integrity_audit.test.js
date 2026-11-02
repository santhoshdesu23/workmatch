import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { Review } from '../src/models/Review.js';
import { Report } from '../src/models/Report.js';
import { VerificationRequest } from '../src/models/VerificationRequest.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmailOtp } from '../src/models/EmailOtp.js';
import { _testEmailMock } from '../src/services/emailService.js';
import { ROLES, JOB_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES, APPLICATION_STATUSES } from '../src/config/constants.js';

describe('Security and Data-Integrity Audit Remediation Test Suite', () => {
  let adminToken, adminId;
  let employerToken, employerId;
  let workerToken, workerId;
  let worker2Token, worker2Id;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();

    // Setup Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Security Admin',
      email: `sec.admin.${Date.now()}@test.local`,
      password: 'AdminPassword123!',
      role: 'employer'
    });
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;
    await User.findByIdAndUpdate(adminId, { role: ROLES.ADMIN, emailVerified: true });

    // Setup Employer
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Security Employer',
      email: `sec.emp.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'employer',
      businessName: 'Integrity Tech'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;
    await User.findByIdAndUpdate(employerId, { emailVerified: true });

    // Setup Worker 1
    const w1Res = await request(app).post('/api/auth/register').send({
      name: 'Worker Alpha',
      email: `worker.alpha.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'worker'
    });
    workerToken = w1Res.body.token;
    workerId = w1Res.body.user.id;
    await User.findByIdAndUpdate(workerId, { emailVerified: true });

    // Setup Worker 2
    const w2Res = await request(app).post('/api/auth/register').send({
      name: 'Worker Beta',
      email: `worker.beta.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'worker'
    });
    worker2Token = w2Res.body.token;
    worker2Id = w2Res.body.user.id;
    await User.findByIdAndUpdate(worker2Id, { emailVerified: true });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. REGISTRATION OTP SECURITY
  // =========================================================================
  describe('1. Registration OTP Security & Atomic Consumption', () => {
    const generateVerifiedOtp = async (email) => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await EmailOtp.create({
        email: email.toLowerCase().trim(),
        otpHash: 'dummyhash',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 1,
        verified: true,
        verificationToken: tokenHash,
        verifiedExpires: new Date(Date.now() + 15 * 60 * 1000)
      });
      return rawToken;
    };

    it('rejects registration when verificationToken is completely missing in enforced mode', async () => {
      const email = `missing.otp.${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/auth/register')
        .set('x-require-otp-verification', 'true')
        .send({
          name: 'Missing Token',
          email,
          password: 'Password123!',
          role: 'worker'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('rejects registration when verificationToken does not match the stored hash for the email', async () => {
      const email = `mismatch.otp.${Date.now()}@test.local`;
      await generateVerifiedOtp(email);

      const res = await request(app)
        .post('/api/auth/register')
        .set('x-require-otp-verification', 'true')
        .send({
          name: 'Mismatched Token',
          email,
          password: 'Password123!',
          role: 'worker',
          verificationToken: 'completely-wrong-token-value'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('rejects registration when verifiedExpires has elapsed (expired token)', async () => {
      const email = `expired.otp.${Date.now()}@test.local`;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await EmailOtp.create({
        email: email.toLowerCase().trim(),
        otpHash: 'dummy',
        expiresAt: new Date(Date.now() - 10000),
        attempts: 1,
        verified: true,
        verificationToken: tokenHash,
        verifiedExpires: new Date(Date.now() - 1000) // expired
      });

      const res = await request(app)
        .post('/api/auth/register')
        .set('x-require-otp-verification', 'true')
        .send({
          name: 'Expired Token User',
          email,
          password: 'Password123!',
          role: 'worker',
          verificationToken: rawToken
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('enforces single-use consumption: replaying a valid token is rejected', async () => {
      const email = `replay.otp.${Date.now()}@test.local`;
      const rawToken = await generateVerifiedOtp(email);

      // First consumption succeeds
      const res1 = await request(app)
        .post('/api/auth/register')
        .set('x-require-otp-verification', 'true')
        .send({
          name: 'First Legit User',
          email,
          password: 'Password123!',
          role: 'worker',
          verificationToken: rawToken
        });
      expect(res1.status).toBe(201);

      // Second consumption with same token must fail
      const res2 = await request(app)
        .post('/api/auth/register')
        .set('x-require-otp-verification', 'true')
        .send({
          name: 'Replay Attacker',
          email: `different.${Date.now()}@test.local`,
          password: 'Password123!',
          role: 'worker',
          verificationToken: rawToken
        });
      expect(res2.status).toBe(403);
    });

    it('prevents concurrent double-consumption of the same OTP token', async () => {
      const email = `concurrent.otp.${Date.now()}@test.local`;
      const rawToken = await generateVerifiedOtp(email);

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/auth/register')
          .set('x-require-otp-verification', 'true')
          .send({
            name: 'Concurrent User 1',
            email,
            password: 'Password123!',
            role: 'worker',
            verificationToken: rawToken
          }),
        request(app)
          .post('/api/auth/register')
          .set('x-require-otp-verification', 'true')
          .send({
            name: 'Concurrent User 2',
            email,
            password: 'Password123!',
            role: 'worker',
            verificationToken: rawToken
          })
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 201).length;
      const failureCount = [res1, res2].filter((r) => r.status === 403 || r.status === 409).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  // =========================================================================
  // 2. ASSIGNMENT COMPLETION AND CANCELLATION
  // =========================================================================
  describe('2. Assignment Completion & Cancellation Invariants', () => {
    let testJob, testAssignment;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const afterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);

      testJob = await Job.create({
        employer: employerId,
        title: 'Warehouse Security Lead',
        description: 'Overseeing perimeter safety.',
        category: 'Security and protective services',
        locationName: 'Andheri East, Mumbai',
        openings: 1,
        filledCount: 1,
        grossPay: 350,
        currency: 'INR',
        payBasis: 'hourly',
        paymentMethod: 'Direct Bank Transfer',
        workDate: tomorrow,
        workEndDate: afterTomorrow,
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        status: JOB_STATUSES.FILLED,
        applicationDeadline: afterTomorrow
      });

      const testApp = await Application.create({
        job: testJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      testAssignment = await Assignment.create({
        job: testJob._id,
        worker: workerId,
        employer: employerId,
        application: testApp._id,
        status: ASSIGNMENT_STATUSES.CONFIRMED,
        agreedSchedule: {
          workDate: testJob.workDate,
          workEndDate: testJob.workEndDate,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8
        },
        agreedPayment: {
          grossAmount: 350,
          currency: 'INR',
          basis: 'hourly'
        }
      });

      await PaymentRecord.create({
        assignment: testAssignment._id,
        job: testJob._id,
        worker: workerId,
        employer: employerId,
        amount: 350,
        status: PAYMENT_STATUSES.DUE
      });
    });

    it('employer confirmation ALONE must not mark a shift COMPLETED (dual-confirmation enforcement)', async () => {
      const res = await request(app)
        .post(`/api/assignments/${testAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Awaiting confirmation from the other party/i);

      // Invariant: Status must remain CONFIRMED, not completed
      const checkAssignment = await Assignment.findById(testAssignment._id);
      expect(checkAssignment.status).toBe(ASSIGNMENT_STATUSES.CONFIRMED);
      expect(checkAssignment.completionConfirmations.employerConfirmed).toBe(true);
      expect(checkAssignment.completionConfirmations.workerConfirmed).toBe(false);

      // Invariant: completedJobsCount on worker must NOT be incremented yet
      const profile = await WorkerProfile.findOne({ user: workerId });
      expect(profile?.completedJobsCount || 0).toBe(0);
    });

    it('subsequent worker confirmation completes dual confirmation and marks shift COMPLETED', async () => {
      const res = await request(app)
        .post(`/api/assignments/${testAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/marked as completed/i);

      const checkAssignment = await Assignment.findById(testAssignment._id);
      expect(checkAssignment.status).toBe(ASSIGNMENT_STATUSES.COMPLETED);

      // Invariant: Payment transitioned to PROCESSING
      const payRecord = await PaymentRecord.findOne({ assignment: testAssignment._id });
      expect(payRecord.status).toBe(PAYMENT_STATUSES.PROCESSING);

      // Invariant: completedJobsCount incremented exactly once
      const profile = await WorkerProfile.findOne({ user: workerId });
      expect(profile.completedJobsCount).toBe(1);
    });

    it('rejects confirmation after assignment is already COMPLETED', async () => {
      const res = await request(app)
        .post(`/api/assignments/${testAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already marked as completed/i);
    });

    it('rejects cancellation after shift has been completed', async () => {
      const res = await request(app)
        .patch(`/api/assignments/${testAssignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: ASSIGNMENT_STATUSES.CANCELLED, reason: 'Too late' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot modify the status/i);
    });

    it('rejects duplicate cancellation requests and decrements filledCount safely', async () => {
      // Create new assignment for cancellation test
      const cancelJob = await Job.create({
        employer: employerId,
        title: 'Temporary Inventory Audit',
        description: 'Single day count.',
        category: 'Warehouse and packing',
        locationName: 'BKC, Mumbai',
        openings: 1,
        filledCount: 1,
        grossPay: 200,
        currency: 'INR',
        payBasis: 'hourly',
        workDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        workEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        startTime: '10:00',
        endTime: '14:00',
        totalHours: 4,
        status: JOB_STATUSES.FILLED
      });

      const cancelApp = await Application.create({
        job: cancelJob._id,
        worker: worker2Id,
        status: APPLICATION_STATUSES.HIRED
      });

      const cancelAssignment = await Assignment.create({
        job: cancelJob._id,
        worker: worker2Id,
        employer: employerId,
        application: cancelApp._id,
        status: ASSIGNMENT_STATUSES.CONFIRMED,
        agreedSchedule: {
          workDate: cancelJob.workDate,
          startTime: '10:00',
          endTime: '14:00',
          totalHours: 4
        },
        agreedPayment: { grossAmount: 200, currency: 'INR' }
      });

      // First cancellation succeeds
      const r1 = await request(app)
        .patch(`/api/assignments/${cancelAssignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: ASSIGNMENT_STATUSES.CANCELLED, reason: 'Shift not needed' });

      expect(r1.status).toBe(200);

      const jobAfter1 = await Job.findById(cancelJob._id);
      expect(jobAfter1.filledCount).toBe(0);

      // Second duplicate cancellation must be rejected
      const r2 = await request(app)
        .patch(`/api/assignments/${cancelAssignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: ASSIGNMENT_STATUSES.CANCELLED, reason: 'Shift not needed again' });

      expect(r2.status).toBe(400);
      expect(r2.body.message).toMatch(/cannot modify the status/i);

      // Invariant: filledCount does not drop below 0
      const jobAfter2 = await Job.findById(cancelJob._id);
      expect(jobAfter2.filledCount).toBe(0);
    });
  });

  // =========================================================================
  // 3. HIRING CONSISTENCY & SAFE ROLLBACK
  // =========================================================================
  describe('3. Hiring Consistency & Safe Non-Blind Recovery', () => {
    it('concurrent hiring cannot exceed job openings', async () => {
      const singleOpeningJob = await Job.create({
        employer: employerId,
        title: 'Single Spot Electrician',
        description: 'Wiring check',
        category: 'Construction and maintenance',
        locationName: 'Dadar, Mumbai',
        openings: 1,
        filledCount: 0,
        grossPay: 400,
        currency: 'INR',
        payBasis: 'hourly',
        workDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        workEndDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        startTime: '08:00',
        endTime: '16:00',
        totalHours: 8,
        status: JOB_STATUSES.OPEN
      });

      const app1 = await Application.create({
        job: singleOpeningJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.APPLIED
      });

      const app2 = await Application.create({
        job: singleOpeningJob._id,
        worker: worker2Id,
        status: APPLICATION_STATUSES.APPLIED
      });

      // Race two hire requests
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/applications/${app1._id}/status`)
          .set('Authorization', `Bearer ${employerToken}`)
          .send({ status: APPLICATION_STATUSES.HIRED }),
        request(app)
          .patch(`/api/applications/${app2._id}/status`)
          .set('Authorization', `Bearer ${employerToken}`)
          .send({ status: APPLICATION_STATUSES.HIRED })
      ]);

      const successHires = [res1, res2].filter((r) => r.status === 200).length;
      const rejectedHires = [res1, res2].filter((r) => r.status === 400 || r.status === 409).length;

      expect(successHires).toBe(1);
      expect(rejectedHires).toBe(1);

      const finalJob = await Job.findById(singleOpeningJob._id);
      expect(finalJob.filledCount).toBe(1);
      expect(finalJob.status).toBe(JOB_STATUSES.FILLED);
    });
  });

  // =========================================================================
  // 4. PAYMENT STATE INTEGRITY
  // =========================================================================
  describe('4. Payment State Transitions & Ledger Dual-Attestation', () => {
    let paymentRecord;

    beforeAll(async () => {
      const dummyJob = await Job.create({
        employer: employerId,
        title: 'Event Usher',
        description: 'Greeting guests',
        category: 'Events and hospitality',
        locationName: 'Worli, Mumbai',
        openings: 1,
        filledCount: 1,
        grossPay: 150,
        payBasis: 'hourly',
        workDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        startTime: '10:00',
        endTime: '15:00',
        totalHours: 5,
        status: JOB_STATUSES.OPEN
      });

      const dummyApp = await Application.create({
        job: dummyJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      const dummyAssignment = await Assignment.create({
        job: dummyJob._id,
        worker: workerId,
        employer: employerId,
        application: dummyApp._id,
        status: ASSIGNMENT_STATUSES.CONFIRMED,
        agreedSchedule: { workDate: dummyJob.workDate, startTime: '10:00', endTime: '15:00', totalHours: 5 },
        agreedPayment: { grossAmount: 150 }
      });

      paymentRecord = await PaymentRecord.create({
        assignment: dummyAssignment._id,
        job: dummyJob._id,
        worker: workerId,
        employer: employerId,
        amount: 150,
        status: PAYMENT_STATUSES.DUE,
        verificationSource: 'employer_recorded'
      });
    });

    it('rejects invalid or contradictory status transitions (e.g. DUE -> CANCELLED -> PAID)', async () => {
      // First cancel the payment
      const cancelRes = await request(app)
        .patch(`/api/payments/${paymentRecord._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: PAYMENT_STATUSES.CANCELLED });
      expect(cancelRes.status).toBe(200);

      // Now attempt invalid transition from CANCELLED to PAID
      const invalidRes = await request(app)
        .patch(`/api/payments/${paymentRecord._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: PAYMENT_STATUSES.PAID });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.message).toMatch(/invalid payment status transition/i);
    });

    it('prevents employers from spoofing verificationSource as provider_verified', async () => {
      // Create a fresh DUE payment
      await PaymentRecord.findByIdAndUpdate(paymentRecord._id, { status: PAYMENT_STATUSES.PROCESSING });

      const spoofRes = await request(app)
        .patch(`/api/payments/${paymentRecord._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: PAYMENT_STATUSES.PAID,
          verificationSource: 'provider_verified'
        });

      expect(spoofRes.status).toBe(400);
      expect(spoofRes.body.message).toMatch(/provider_verified is reserved/i);
    });

    it('rejects worker confirming receipt before payment is marked PAID', async () => {
      // payment is in PROCESSING
      const prematureRes = await request(app)
        .post(`/api/payments/${paymentRecord._id}/confirm-receipt`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});

      expect(prematureRes.status).toBe(400);
      expect(prematureRes.body.message).toMatch(/payment must be marked paid first/i);
    });

    it('allows valid PAID update and worker receipt confirmation', async () => {
      // Employer marks PAID legitimately
      const payRes = await request(app)
        .patch(`/api/payments/${paymentRecord._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: PAYMENT_STATUSES.PAID, paymentMethod: 'UPI / Direct Bank' });
      expect(payRes.status).toBe(200);
      expect(payRes.body.payment.verificationSource).toBe('employer_recorded');

      // Worker confirms receipt
      const receiptRes = await request(app)
        .post(`/api/payments/${paymentRecord._id}/confirm-receipt`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});
      expect(receiptRes.status).toBe(200);
      expect(receiptRes.body.payment.workerConfirmedReceipt).toBe(true);
      expect(receiptRes.body.payment.verificationSource).toBe('worker_confirmed');
    });

    it('rejects repeated receipt confirmation from worker', async () => {
      const repeatRes = await request(app)
        .post(`/api/payments/${paymentRecord._id}/confirm-receipt`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});

      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.message).toMatch(/already been confirmed/i);
    });
  });

  // =========================================================================
  // 5. REVIEW AND MODERATION VALIDATION
  // =========================================================================
  describe('5. Review & Moderation Integrity', () => {
    let completedAssignment;

    beforeAll(async () => {
      const reviewJob = await Job.create({
        employer: employerId,
        title: 'Sous Chef Support',
        description: 'Prep kitchen support',
        category: 'Food preparation and service',
        locationName: 'Bandra West, Mumbai',
        openings: 1,
        filledCount: 1,
        grossPay: 300,
        payBasis: 'hourly',
        workDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        status: JOB_STATUSES.COMPLETED
      });

      const completedApp = await Application.create({
        job: reviewJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      completedAssignment = await Assignment.create({
        job: reviewJob._id,
        worker: workerId,
        employer: employerId,
        application: completedApp._id,
        status: ASSIGNMENT_STATUSES.COMPLETED,
        agreedSchedule: { workDate: reviewJob.workDate, startTime: '10:00', endTime: '18:00', totalHours: 8 },
        agreedPayment: { grossAmount: 300 }
      });
    });

    it('rejects non-integer ratings (e.g. 4.5)', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 4.5,
          reviewText: 'Great shift overall!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/integer between 1 and 5/i);
    });

    it('rejects out of range ratings (< 1 or > 5)', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 6,
          reviewText: 'Outstanding!'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/integer between 1 and 5/i);
    });

    it('rejects bounded text violations (< 5 characters or > 1000 characters)', async () => {
      const shortRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 5,
          reviewText: 'Hi'
        });
      expect(shortRes.status).toBe(400);
      expect(shortRes.body.message).toMatch(/between 5 and 1000 characters/i);

      const longRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 5,
          reviewText: 'x'.repeat(1005)
        });
      expect(longRes.status).toBe(400);
      expect(longRes.body.message).toMatch(/between 5 and 1000 characters/i);
    });

    it('allows valid review submission and handles concurrent duplicate submission with 409', async () => {
      // First review succeeds
      const res1 = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 5,
          reviewText: 'Excellent employer, paid on time and clear briefing.'
        });
      expect(res1.status).toBe(201);
      expect(res1.body.review.rating).toBe(5);

      // Duplicate review is rejected with 409
      const res2 = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId: completedAssignment._id,
          rating: 4,
          reviewText: 'Submitting duplicate review attempt.'
        });
      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/already submitted a review/i);
    });

    it('validates admin report status allowlist', async () => {
      const report = await Report.create({
        reporter: workerId,
        reportedUser: employerId,
        category: 'other',
        description: 'Testing moderation status validation allowlist.',
        status: 'pending'
      });

      // Attempt to set invalid report status
      const res = await request(app)
        .patch(`/api/admin/reports/${report._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'invalid_status_value',
          resolutionNotes: 'Testing'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid report status/i);
    });

    it('validates admin verification review status allowlist', async () => {
      const vReq = await VerificationRequest.create({
        user: workerId,
        verificationType: 'identity',
        status: 'pending'
      });

      // Attempt to set invalid verification status
      const res = await request(app)
        .patch(`/api/admin/verifications/${vReq._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'not_allowed_status',
          reviewNotes: 'Testing'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid verification status/i);
    });
  });
});
