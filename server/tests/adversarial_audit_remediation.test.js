import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { Review } from '../src/models/Review.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { runSeed } from '../src/seed.js';
import { _setTestGeneralLimit, _resetGeneralApiLimiter } from '../src/middleware/rateLimiters.js';
import { ROLES, JOB_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES, APPLICATION_STATUSES } from '../src/config/constants.js';

describe('Adversarial Security Audit Remediation Test Suite', () => {
  let adminToken, adminId;
  let employerToken, employerId;
  let employer2Token, employer2Id;
  let workerToken, workerId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    await connectDB();

    // 1. Create Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Audit Admin',
      email: `audit.admin.${Date.now()}@test.local`,
      password: 'AdminPassword123!',
      role: 'employer'
    });
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;
    await User.findByIdAndUpdate(adminId, { role: ROLES.ADMIN, emailVerified: true });

    // 2. Create Employer 1
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Audit Employer 1',
      email: `audit.emp1.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'employer',
      businessName: 'Audit Org 1'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;
    await User.findByIdAndUpdate(employerId, { emailVerified: true });

    // 3. Create Employer 2
    const emp2Res = await request(app).post('/api/auth/register').send({
      name: 'Audit Employer 2',
      email: `audit.emp2.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'employer',
      businessName: 'Audit Org 2'
    });
    employer2Token = emp2Res.body.token;
    employer2Id = emp2Res.body.user.id;
    await User.findByIdAndUpdate(employer2Id, { emailVerified: true });

    // 4. Create Worker
    const wRes = await request(app).post('/api/auth/register').send({
      name: 'Audit Worker',
      email: `audit.worker.${Date.now()}@test.local`,
      password: 'Password123!',
      role: 'worker'
    });
    workerToken = wRes.body.token;
    workerId = wRes.body.user.id;
    await User.findByIdAndUpdate(workerId, { emailVerified: true });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // FIX 1: JOB UPDATE MASS ASSIGNMENT
  // =========================================================================
  describe('Fix 1: Job Update Mass Assignment Protection', () => {
    let testJob;

    beforeEach(async () => {
      testJob = await Job.create({
        employer: employerId,
        title: 'Original Banquet Server',
        description: 'Original job description for testing',
        category: 'Event assistance',
        openings: 3,
        filledCount: 1,
        locationName: 'Convention Center',
        location: { type: 'Point', coordinates: [-73.98, 40.75] },
        workDate: new Date(Date.now() + 86400000),
        applicationDeadline: new Date(Date.now() + 86400000),
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        grossPay: 200,
        payBasis: 'shift',
        status: JOB_STATUSES.OPEN
      });
    });

    it('rejects attempts to reassign job ownership, modify filledCount, or change status', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Legitimate Updated Title',
          employer: employer2Id, // Malicious: attempt to reassign to employer 2
          filledCount: 0,        // Malicious: attempt to wipe filledCount counter
          status: 'COMPLETED'    // Malicious: attempt to force status
        });

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe('Legitimate Updated Title');
      // Crucial: employer ownership remains unchanged
      expect(res.body.job.employer.toString()).toBe(employerId.toString());
      // Crucial: filledCount remains 1
      expect(res.body.job.filledCount).toBe(1);
      // Crucial: status remains OPEN
      expect(res.body.job.status).toBe(JOB_STATUSES.OPEN);

      const dbJob = await Job.findById(testJob._id);
      expect(dbJob.employer.toString()).toBe(employerId.toString());
      expect(dbJob.filledCount).toBe(1);
      expect(dbJob.status).toBe(JOB_STATUSES.OPEN);
    });

    it('prevents reducing openings below the number of already committed hires', async () => {
      // testJob has filledCount = 2, openings = 3. Reducing openings to 1 should be rejected.
      await Job.findByIdAndUpdate(testJob._id, { filledCount: 2 });
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ openings: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot reduce openings/i);
    });

    it('allows valid job updates on permitted fields', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Updated Banquet Captain',
          grossPay: 250,
          description: 'Updated shift details with higher pay.'
        });

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe('Updated Banquet Captain');
      expect(res.body.job.grossPay).toBe(250);
    });
  });

  // =========================================================================
  // FIX 2: SEEDED ADMIN CREDENTIALS PRODUCTION GUARD
  // =========================================================================
  describe('Fix 2: Seed Script Production Guard', () => {
    it('refuses to run seed script when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(runSeed()).rejects.toThrow(/FATAL SECURITY VIOLATION/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // =========================================================================
  // FIX 3: SENSITIVE ADMIN RESPONSE PRIVACY
  // =========================================================================
  describe('Fix 3: Sensitive Admin Response Privacy', () => {
    it('PATCH /api/admin/users/:userId/status never leaks passwordHash, reset tokens, or verification tokens', async () => {
      const targetUser = await User.create({
        name: 'Target Sensitive User',
        email: `sensitive.target.${Date.now()}@test.local`,
        passwordHash: '$2a$10$dummyHashNotARealSecretValueHere',
        resetPasswordToken: 'dummysha256resethash12345',
        resetPasswordExpires: new Date(Date.now() + 3600000),
        emailVerificationToken: 'dummysha256verificationhash12345',
        emailVerificationExpires: new Date(Date.now() + 86400000),
        role: 'worker',
        accountStatus: 'active'
      });

      const res = await request(app)
        .patch(`/api/admin/users/${targetUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended', reason: 'Audit investigation' });

      expect(res.status).toBe(200);
      expect(res.body.user.accountStatus).toBe('suspended');

      // Verify complete absence of sensitive credentials
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.resetPasswordToken).toBeUndefined();
      expect(res.body.user.resetPasswordExpires).toBeUndefined();
      expect(res.body.user.emailVerificationToken).toBeUndefined();
      expect(res.body.user.emailVerificationExpires).toBeUndefined();
      expect(res.body.user.tokenVersion).toBeUndefined();
    });

    it('GET /api/admin/users excludes passwordHash and secret tokens', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);

      for (const u of res.body.users) {
        expect(u.passwordHash).toBeUndefined();
        expect(u.resetPasswordToken).toBeUndefined();
        expect(u.emailVerificationToken).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // FIX 4: ASSIGNMENT STATUS TRANSITIONS & INVARIANTS
  // =========================================================================
  describe('Fix 4: Assignment Status State Machine & Guards', () => {
    let job, appRecord, assignment;

    beforeEach(async () => {
      job = await Job.create({
        employer: employerId,
        title: 'Catering Assistant',
        description: 'Prep and catering support',
        category: 'Event assistance',
        openings: 2,
        filledCount: 1,
        locationName: 'Banquet Hall',
        location: { type: 'Point', coordinates: [-73.98, 40.75] },
        workDate: new Date(Date.now() + 86400000),
        applicationDeadline: new Date(Date.now() + 86400000),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 180,
        payBasis: 'shift',
        status: JOB_STATUSES.OPEN
      });

      appRecord = await Application.create({
        job: job._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      assignment = await Assignment.create({
        job: job._id,
        worker: workerId,
        employer: employerId,
        application: appRecord._id,
        agreedSchedule: {
          workDate: job.workDate,
          startTime: job.startTime,
          endTime: job.endTime,
          totalHours: job.totalHours
        },
        agreedPayment: {
          grossAmount: 180,
          currency: 'USD',
          basis: 'shift'
        },
        status: ASSIGNMENT_STATUSES.CONFIRMED
      });

      await PaymentRecord.create({
        assignment: assignment._id,
        job: job._id,
        worker: workerId,
        employer: employerId,
        amount: 180,
        currency: 'USD',
        basis: 'shift',
        status: PAYMENT_STATUSES.DUE,
        expectedDate: job.workDate
      });
    });

    it('rejects direct patch of status to COMPLETED (forces /confirm-completion workflow)', async () => {
      const res = await request(app)
        .patch(`/api/assignments/${assignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: ASSIGNMENT_STATUSES.COMPLETED });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirm-completion/i);
    });

    it('rejects invalid or arbitrary assignment statuses', async () => {
      const res = await request(app)
        .patch(`/api/assignments/${assignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'ARBITRARY_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid assignment status/i);
    });

    it('cancelling assignment via status patch updates job capacity and cancels DUE payments', async () => {
      expect(job.filledCount).toBe(1);

      const res = await request(app)
        .patch(`/api/assignments/${assignment._id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: ASSIGNMENT_STATUSES.CANCELLED, notes: 'Worker requested cancellation' });

      expect(res.status).toBe(200);
      expect(res.body.assignment.status).toBe(ASSIGNMENT_STATUSES.CANCELLED);

      // Invariant: Job filledCount must be decremented
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.filledCount).toBe(0);

      // Invariant: DUE Payment must be cancelled
      const payRecord = await PaymentRecord.findOne({ assignment: assignment._id });
      expect(payRecord.status).toBe(PAYMENT_STATUSES.CANCELLED);
    });

    it('confirmCompletion on cancelled assignment is rejected', async () => {
      await Assignment.findByIdAndUpdate(assignment._id, { status: ASSIGNMENT_STATUSES.CANCELLED });

      const res = await request(app)
        .post(`/api/assignments/${assignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot confirm completion for a cancelled/i);
    });

    it('duplicate completion confirmation by the same actor is rejected', async () => {
      // First confirmation by worker succeeds
      const r1 = await request(app)
        .post(`/api/assignments/${assignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});
      expect(r1.status).toBe(200);

      // Second confirmation by the same worker is rejected
      const r2 = await request(app)
        .post(`/api/assignments/${assignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});
      expect(r2.status).toBe(400);
      expect(r2.body.message).toMatch(/already confirmed completion/i);
    });
  });

  // =========================================================================
  // FIX 5: JOB CANCELLATION CONSISTENCY
  // =========================================================================
  describe('Fix 5: Job Cancellation Consistency', () => {
    it('cancelling a job cascades cancellation to active assignments and DUE payments', async () => {
      const cancelJob = await Job.create({
        employer: employerId,
        title: 'Warehouse Logistics Assistant',
        description: 'Staging and packing',
        category: 'Warehouse and packing',
        openings: 1,
        filledCount: 1,
        locationName: 'Warehouse 4',
        location: { type: 'Point', coordinates: [-73.98, 40.75] },
        workDate: new Date(Date.now() + 86400000),
        applicationDeadline: new Date(Date.now() + 86400000),
        startTime: '08:00',
        endTime: '16:00',
        totalHours: 8,
        grossPay: 160,
        payBasis: 'shift',
        status: JOB_STATUSES.OPEN
      });

      const cancelApp = await Application.create({
        job: cancelJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.HIRED
      });

      const cancelAssignment = await Assignment.create({
        job: cancelJob._id,
        worker: workerId,
        employer: employerId,
        application: cancelApp._id,
        agreedSchedule: {
          workDate: cancelJob.workDate,
          startTime: cancelJob.startTime,
          endTime: cancelJob.endTime,
          totalHours: 8
        },
        agreedPayment: { grossAmount: 160, currency: 'USD', basis: 'shift' },
        status: ASSIGNMENT_STATUSES.CONFIRMED
      });

      const cancelPayment = await PaymentRecord.create({
        assignment: cancelAssignment._id,
        job: cancelJob._id,
        worker: workerId,
        employer: employerId,
        amount: 160,
        currency: 'USD',
        basis: 'shift',
        status: PAYMENT_STATUSES.DUE,
        expectedDate: cancelJob.workDate
      });

      const res = await request(app)
        .post(`/api/jobs/${cancelJob._id}/cancel`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ reason: 'Facility maintenance closure' });

      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe(JOB_STATUSES.CANCELLED);

      // Invariant: Assignment must be cancelled
      const dbAssign = await Assignment.findById(cancelAssignment._id);
      expect(dbAssign.status).toBe(ASSIGNMENT_STATUSES.CANCELLED);
      expect(dbAssign.cancellationReason).toMatch(/maintenance/i);

      // Invariant: DUE Payment must be cancelled
      const dbPay = await PaymentRecord.findById(cancelPayment._id);
      expect(dbPay.status).toBe(PAYMENT_STATUSES.CANCELLED);

      // Invariant: Worker cannot confirm completion on cancelled shift
      const completeRes = await request(app)
        .post(`/api/assignments/${cancelAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({});
      expect(completeRes.status).toBe(400);
    });
  });

  // =========================================================================
  // FIX 6: PUBLIC REVIEW PRIVACY
  // =========================================================================
  describe('Fix 6: Public Review Privacy', () => {
    it('GET /api/reviews/:userId never leaks payment details, attendance notes, or application IDs', async () => {
      const dummyAssign = await Assignment.create({
        job: new User()._id,
        worker: workerId,
        employer: employerId,
        application: new User()._id,
        agreedSchedule: {
          workDate: new Date(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8
        },
        agreedPayment: {
          grossAmount: 9999, // Secret payment amount
          currency: 'USD',
          basis: 'hourly'
        },
        attendance: {
          notes: 'SECRET_ATTENDANCE_INTERNAL_NOTES_DO_NOT_LEAK'
        },
        status: ASSIGNMENT_STATUSES.COMPLETED
      });

      await Review.create({
        assignment: dummyAssign._id,
        reviewer: employerId,
        reviewee: workerId,
        rating: 5,
        reviewText: 'Outstanding reliable worker on time.',
        status: 'published'
      });

      // Anonymous public request
      const res = await request(app).get(`/api/reviews/${workerId}`);
      expect(res.status).toBe(200);
      expect(res.body.reviews.length).toBeGreaterThan(0);

      const review = res.body.reviews[0];
      expect(review.reviewText).toBe('Outstanding reliable worker on time.');

      // Check populated assignment field isolation
      if (review.assignment) {
        // Safe schedule fields preserved
        expect(review.assignment.agreedSchedule?.totalHours).toBe(8);

        // Private fields must be undefined
        expect(review.assignment.agreedPayment).toBeUndefined();
        expect(review.assignment.attendance).toBeUndefined();
        expect(review.assignment.application).toBeUndefined();
        expect(review.assignment.worker).toBeUndefined();
        expect(review.assignment.employer).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // FIX 7: EMPLOYER APPLICANT PRIVACY
  // =========================================================================
  describe('Fix 7: Employer Applicant Privacy', () => {
    it('GET /api/jobs/:jobId/applications excludes worker savedJobs bookmarks', async () => {
      const applicantJob = await Job.create({
        employer: employerId,
        title: 'Exhibition Greeter',
        description: 'Customer greeting',
        category: 'Event assistance',
        openings: 5,
        filledCount: 0,
        locationName: 'Expo Center',
        location: { type: 'Point', coordinates: [-73.98, 40.75] },
        workDate: new Date(Date.now() + 86400000),
        applicationDeadline: new Date(Date.now() + 86400000),
        startTime: '10:00',
        endTime: '16:00',
        totalHours: 6,
        grossPay: 120,
        payBasis: 'shift',
        status: JOB_STATUSES.OPEN
      });

      // Worker bookmarks a secret private job
      const privateJob = await Job.create({
        employer: employer2Id,
        title: 'Secret Bookmarked Job',
        description: 'Secret',
        category: 'Event assistance',
        openings: 1,
        locationName: 'Confidential',
        location: { type: 'Point', coordinates: [0, 0] },
        workDate: new Date(),
        applicationDeadline: new Date(),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 500,
        status: JOB_STATUSES.OPEN
      });

      await WorkerProfile.findOneAndUpdate(
        { user: workerId },
        { $set: { savedJobs: [privateJob._id], skills: ['Greeting', 'Customer Service'] } },
        { upsert: true }
      );

      await Application.create({
        job: applicantJob._id,
        worker: workerId,
        status: APPLICATION_STATUSES.APPLIED
      });

      const res = await request(app)
        .get(`/api/jobs/${applicantJob._id}/applications`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.applicants.length).toBeGreaterThan(0);

      const applicant = res.body.applicants[0];
      expect(applicant.workerProfile).toBeDefined();
      expect(applicant.workerProfile.skills).toContain('Greeting');
      // Invariant: savedJobs bookmarks must be absent
      expect(applicant.workerProfile.savedJobs).toBeUndefined();
    });
  });

  // =========================================================================
  // FIX 8: RATE LIMITER MOUNTING COVERAGE
  // =========================================================================
  describe('Fix 8: Rate Limiter Mounting Coverage', () => {
    beforeEach(() => {
      _resetGeneralApiLimiter();
    });

    afterEach(() => {
      _setTestGeneralLimit(null);
      _resetGeneralApiLimiter();
    });

    it('enforces rate limits on both /api/jobs and root /jobs requests', async () => {
      _setTestGeneralLimit(2);

      // Request 1: via /api/jobs -> OK (200)
      const r1 = await request(app).get('/api/jobs');
      expect(r1.status).toBe(200);

      // Request 2: via /jobs (root mount) -> OK (200)
      const r2 = await request(app).get('/jobs');
      expect(r2.status).toBe(200);

      // Request 3: either path exceeds limit -> 429
      const r3 = await request(app).get('/jobs');
      expect(r3.status).toBe(429);
      expect(r3.body.message).toMatch(/rate limit exceeded/i);
    });
  });
});
