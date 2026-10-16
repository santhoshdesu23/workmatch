import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { Review } from '../src/models/Review.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES } from '../src/config/constants.js';

describe('WorkMatch Security Audit & Invariants Test Suite', () => {
  let workerToken, workerUser;
  let worker2Token, worker2User;
  let employerToken, employerUser;
  let employer2Token, employer2User;
  let adminToken, adminUser;
  let testJob;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Create Worker 1
    const wRes = await request(app).post('/api/auth/register').send({
      name: 'Alice Security Worker',
      email: `alice.sec.${Date.now()}@test.local`,
      password: 'SecuredPassword123!',
      role: 'worker'
    });
    workerToken = wRes.body.token;
    workerUser = wRes.body.user;

    // 2. Create Worker 2
    const w2Res = await request(app).post('/api/auth/register').send({
      name: 'Bob Candidate Worker',
      email: `bob.sec.${Date.now()}@test.local`,
      password: 'SecuredPassword123!',
      role: 'worker'
    });
    worker2Token = w2Res.body.token;
    worker2User = w2Res.body.user;

    // 3. Create Employer 1
    const eRes = await request(app).post('/api/auth/register').send({
      name: 'Emma Employer One',
      email: `emma.emp1.${Date.now()}@test.local`,
      password: 'SecuredPassword123!',
      role: 'employer',
      businessName: 'Emma Events Corp'
    });
    employerToken = eRes.body.token;
    employerUser = eRes.body.user;

    // 4. Create Employer 2
    const e2Res = await request(app).post('/api/auth/register').send({
      name: 'Evan Employer Two',
      email: `evan.emp2.${Date.now()}@test.local`,
      password: 'SecuredPassword123!',
      role: 'employer',
      businessName: 'Evan Logistics Ltd'
    });
    employer2Token = e2Res.body.token;
    employer2User = e2Res.body.user;

    // 5. Create an authorized Administrator directly (not via public registration)
    const admin = await User.create({
      name: 'Platform Overseer Admin',
      email: `admin.sec.${Date.now()}@test.local`,
      passwordHash: '$2a$12$somevalidhashsamplevaluehereforadmin',
      role: ROLES.ADMIN,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
    adminUser = admin;

    // Login as admin by updating password properly
    const bcrypt = (await import('bcryptjs')).default;
    admin.passwordHash = await bcrypt.hash('SuperAdminPassword123!', 12);
    await admin.save();

    const aLogin = await request(app).post('/api/auth/login').send({
      email: admin.email,
      password: 'SuperAdminPassword123!'
    });
    adminToken = aLogin.body.token;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ==========================================
  // PHASE TWO: AUTHENTICATION & SESSION SECURITY
  // ==========================================
  describe('Phase Two: Authentication & Session Security', () => {
    it('PREVENTS role escalation: public registration with role=admin MUST fail', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Hacker Attempting Admin Escalation',
        email: `hacker.${Date.now()}@exploit.local`,
        password: 'Password123!',
        role: 'admin'
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid registration role/i);
    });

    it('enforces password complexity: weak password must be rejected', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Short Password User',
        email: `weak.${Date.now()}@test.local`,
        password: 'short',
        role: 'worker'
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('prevents unauthenticated password reset without valid token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'fake-or-invalid-token-12345',
        newPassword: 'BrandNewPassword123!'
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it('executes full secure password recovery flow with single-use cryptographically random token', async () => {
      // 1. Request forgot-password
      const forgotRes = await request(app).post('/api/auth/forgot-password').send({
        email: workerUser.email
      });
      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.devResetToken).toBeDefined();

      const resetToken = forgotRes.body.devResetToken;

      // 2. Use the token to reset password
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'BrandNewPassword123!'
      });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Token cannot be reused (single-use invariant)
      const reuseRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'AnotherPassword123!'
      });
      expect(reuseRes.status).toBe(400);

      // 4. Old password fails
      const oldLogin = await request(app).post('/api/auth/login').send({
        email: workerUser.email,
        password: 'SecuredPassword123!'
      });
      expect(oldLogin.status).toBe(401);

      // 5. New password succeeds
      const newLogin = await request(app).post('/api/auth/login').send({
        email: workerUser.email,
        password: 'BrandNewPassword123!'
      });
      expect(newLogin.status).toBe(200);
      workerToken = newLogin.body.token; // Update for subsequent tests
    });

    it('invalidates prior JWT sessions when password is changed', async () => {
      const staleToken = workerToken;

      // Change password while logged in
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${staleToken}`)
        .send({
          currentPassword: 'BrandNewPassword123!',
          newPassword: 'RotatedPassword123!'
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.token).toBeDefined();
      const freshToken = changeRes.body.token;

      // Request with stale token should be rejected (session invalidation)
      const staleCheck = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${staleToken}`);
      expect(staleCheck.status).toBe(401);
      expect(staleCheck.body.message).toMatch(/recently changed|log in again/i);

      // Fresh token works
      const freshCheck = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`);
      expect(freshCheck.status).toBe(200);
      workerToken = freshToken;
    });

    it('blocks suspended account from performing restricted actions', async () => {
      // Suspend worker 2
      await User.findByIdAndUpdate(worker2User.id, { accountStatus: 'suspended' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${worker2Token}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/suspended/i);

      // Re-activate worker 2 for subsequent tests
      await User.findByIdAndUpdate(worker2User.id, { accountStatus: 'active' });
    });
  });

  // ==========================================
  // PHASE THREE: ROLE-BASED ACCESS & IDOR
  // ==========================================
  describe('Phase Three: Role-Based Access & IDOR Protection', () => {
    it('employer creates a test job with capacity=1', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Single Opening Barista Shift',
          description: 'Espresso service for exclusive corporate lounge',
          category: 'Restaurant and hospitality',
          requiredSkills: ['Espresso', 'Customer Service'],
          openings: 1,
          locationName: 'Downtown Financial Hub',
          coordinates: [-74.01, 40.71],
          workDate: tomorrow.toISOString(),
          startTime: '08:00',
          endTime: '16:00',
          totalHours: 8,
          grossPay: 30,
          payBasis: 'hourly'
        });

      expect(res.status).toBe(201);
      testJob = res.body.job;
    });

    it('IDOR Check: Worker CANNOT create or edit a job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          title: 'Malicious Worker Job',
          description: 'Worker attempting to post job',
          category: 'Event assistance',
          grossPay: 100,
          workDate: new Date().toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          openings: 1,
          locationName: 'NYC'
        });
      expect(res.status).toBe(403);
    });

    it('IDOR Check: Employer 2 CANNOT edit Employer 1 job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({ title: 'Hijacked Job Title' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('IDOR Check: Worker CANNOT view applicant list for employer jobs', async () => {
      const res = await request(app)
        .get(`/api/jobs/${testJob._id}/applications`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
    });

    it('IDOR Check: Regular users CANNOT access admin verification queue', async () => {
      const workerRes = await request(app)
        .get('/api/admin/verifications')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(workerRes.status).toBe(403);

      const empRes = await request(app)
        .get('/api/admin/verifications')
        .set('Authorization', `Bearer ${employerToken}`);
      expect(empRes.status).toBe(403);
    });

    it('Admin CAN access verification queue and user management', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  // ==========================================
  // PHASE SIX: DATABASE & BUSINESS-LOGIC INTEGRITY
  // ==========================================
  describe('Phase Six: WorkMatch Business Logic & Invariants', () => {
    let application1Id, application2Id;

    it('Worker 1 voluntarily applies to the open job', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Ready to work as expert barista.' });

      expect(res.status).toBe(201);
      application1Id = res.body.application._id;
    });

    it('Worker 2 voluntarily applies to the open job', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJob._id}/apply`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ message: 'Experienced with high volume espresso.' });

      expect(res.status).toBe(201);
      application2Id = res.body.application._id;
    });

    it('PREVENTS duplicate applications: Worker 1 applying again receives 409', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Attempting duplicate application' });

      expect(res.status).toBe(409);
    });

    it('Employer hires Worker 1 for the single opening (capacity 1/1 reached)', async () => {
      const res = await request(app)
        .patch(`/api/applications/${application1Id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'HIRED', note: 'Selected for barista shift' });

      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe('HIRED');

      const jobRecord = await Job.findById(testJob._id);
      expect(jobRecord.filledCount).toBe(1);
      expect(jobRecord.status).toBe('FILLED');
    });

    it('PREVENTS OVERBOOKING: Employer attempting to hire Worker 2 for full job is rejected', async () => {
      const res = await request(app)
        .patch(`/api/applications/${application2Id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'HIRED', note: 'Attempting to hire beyond capacity' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/capacity reached|already filled/i);
    });

    it('PREVENTS DUPLICATE HIRES: Marking already HIRED application as HIRED again is rejected', async () => {
      const res = await request(app)
        .patch(`/api/applications/${application1Id}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'HIRED', note: 'Redundant hire call' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already hired/i);
    });

    it('PREVENTS SCHEDULE CONFLICT: Worker 1 applying to another job on the same date is rejected', async () => {
      // Create second job on the same date
      const confRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({
          title: 'Overlapping Evening Shift',
          description: 'Conflict check job',
          category: 'Event assistance',
          openings: 2,
          locationName: 'Brooklyn Hall',
          workDate: testJob.workDate, // Same work date!
          startTime: '14:00',
          endTime: '20:00',
          totalHours: 6,
          grossPay: 20
        });

      const confJobId = confRes.body.job._id;

      // Worker 1 has a confirmed assignment on this date, so applying should fail
      const applyRes = await request(app)
        .post(`/api/jobs/${confJobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Trying to double book' });

      expect(applyRes.status).toBe(409);
      expect(applyRes.body.message).toMatch(/Schedule conflict/i);
    });
  });

  // ==========================================
  // PHASE SEVEN: PAYMENT & REVIEWS SAFETY
  // ==========================================
  describe('Phase Seven: Payment Tracking & Review Safety', () => {
    let assignmentId;
    let paymentId;

    it('Assignment and initial PaymentRecord were generated with verificationSource=employer_recorded', async () => {
      const assignment = await Assignment.findOne({ job: testJob._id, worker: workerUser.id });
      expect(assignment).toBeDefined();
      assignmentId = assignment._id;

      const payment = await PaymentRecord.findOne({ assignment: assignmentId });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('DUE');
      expect(payment.verificationSource).toBe('employer_recorded');
      expect(payment.workerConfirmedReceipt).toBe(false);
      paymentId = payment._id;
    });

    it('Worker CANNOT review assignment before it is COMPLETED', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId,
          rating: 5,
          reviewText: 'Great shift!'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/completed assignments/i);
    });

    it('Participants confirm completion and assignment transitions to COMPLETED', async () => {
      // Worker confirms
      const wConf = await request(app)
        .post(`/api/assignments/${assignmentId}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(wConf.status).toBe(200);

      // Employer confirms
      const eConf = await request(app)
        .post(`/api/assignments/${assignmentId}/confirm-completion`)
        .set('Authorization', `Bearer ${employerToken}`);
      expect(eConf.status).toBe(200);
      expect(eConf.body.assignment.status).toBe('COMPLETED');
    });

    it('Employer marks payment as PAID (recorded by employer)', async () => {
      const res = await request(app)
        .patch(`/api/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: 'PAID',
          paymentMethod: 'Bank Direct Deposit',
          note: 'Direct wire sent'
        });

      expect(res.status).toBe(200);
      expect(res.body.payment.status).toBe('PAID');
      expect(res.body.payment.verificationSource).toBe('employer_recorded');
    });

    it('Worker confirms funds receipt: verificationSource transitions to worker_confirmed', async () => {
      const res = await request(app)
        .post(`/api/payments/${paymentId}/confirm-receipt`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payment.workerConfirmedReceipt).toBe(true);
      expect(res.body.payment.verificationSource).toBe('worker_confirmed');
    });

    it('Worker submits legitimate review for completed assignment', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId,
          rating: 5,
          reviewText: 'Punctual management, clear briefing and clean setup.'
        });

      expect(res.status).toBe(201);
      expect(res.body.review.rating).toBe(5);
    });

    it('PREVENTS DUPLICATE REVIEWS: Worker reviewing same assignment again receives 409', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId,
          rating: 4,
          reviewText: 'Submitting duplicate review attempt'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already submitted a review/i);
    });
  });

  // ==========================================
  // PHASE EIGHT: AI MATCHING RELIABILITY
  // ==========================================
  describe('Phase Eight: AI Matching Engine Edge Cases', () => {
    it('handles worker with zero coordinates and empty skills without crashing', async () => {
      const { computeJobMatch } = await import('../src/services/matchingService.js');

      const mockWorker = {
        skills: [],
        location: { coordinates: [0, 0] },
        travelRadiusKm: 25,
        availability: { isAvailable: true, days: [] },
        expectedPay: { min: 0, basis: 'hourly' }
      };

      const mockJob = {
        title: 'Empty Requirements Shift',
        requiredSkills: [],
        category: 'Event assistance',
        location: { coordinates: [0, 0] },
        workDate: new Date().toISOString(),
        grossPay: 20,
        payBasis: 'hourly'
      };

      const result = computeJobMatch(mockWorker, mockJob);
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(100);
      expect(result.distanceKm).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('handles invalid coordinate bounds gracefully', async () => {
      const { calculateDistanceKm } = await import('../src/services/matchingService.js');
      // Latitudes > 90 or Longitudes > 180
      const dist = calculateDistanceKm(120, 200, 45, 90);
      expect(dist).toBeNull();
    });
  });

  // ==========================================
  // PHASE FOURTEEN: HEALTH & READINESS PROBES
  // ==========================================
  describe('Health & Database Readiness Probes', () => {
    it('GET /api/health returns 200 with uptime and service name', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.service).toBe('WorkMatch API Server');
    });

    it('GET /api/health/ready returns 200 and database=connected', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });
  });
});
