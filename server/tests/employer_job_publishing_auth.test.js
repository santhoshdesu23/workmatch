import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { signToken } from '../src/config/jwt.js';
import { Job } from '../src/models/Job.js';
import { User } from '../src/models/User.js';
import { ROLES, JOB_STATUSES } from '../src/config/constants.js';

describe('Critical Bug Fix: Employer Job Publishing & Role-Based Authorization Suite', () => {
  let employerToken;
  let employerUser;
  let employer2Token;
  let employer2User;
  let unverifiedEmployerToken;
  let workerToken;
  let adminToken;
  let adminUser;
  let createdJobId;

  const getFutureDateString = (daysAhead = 1) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Setup Verified Employer 1
    const emp1Reg = await request(app).post('/api/auth/register').send({
      name: 'Atigre Catering Services',
      email: `emp1.${Date.now()}@workmatch.local`,
      password: 'DemoPassword123!',
      role: ROLES.EMPLOYER,
      businessName: 'Atigre Banquets'
    });
    employerToken = emp1Reg.body.token;
    employerUser = emp1Reg.body.user;
    await User.findByIdAndUpdate(employerUser.id, { emailVerified: true });

    // 2. Setup Verified Employer 2
    const emp2Reg = await request(app).post('/api/auth/register').send({
      name: 'Kolhapur Event Management',
      email: `emp2.${Date.now()}@workmatch.local`,
      password: 'DemoPassword123!',
      role: ROLES.EMPLOYER,
      businessName: 'Kolhapur Events Ltd'
    });
    employer2Token = emp2Reg.body.token;
    employer2User = emp2Reg.body.user;
    await User.findByIdAndUpdate(employer2User.id, { emailVerified: true });

    // 3. Setup Unverified Employer
    const unverifiedReg = await request(app).post('/api/auth/register').send({
      name: 'Unverified Employer',
      email: `unverified.${Date.now()}@workmatch.local`,
      password: 'DemoPassword123!',
      role: ROLES.EMPLOYER,
      businessName: 'Unverified Venue'
    });
    unverifiedEmployerToken = unverifiedReg.body.token;
    await User.findByIdAndUpdate(unverifiedReg.body.user.id, { emailVerified: false });

    // 4. Setup Worker
    const workerReg = await request(app).post('/api/auth/register').send({
      name: 'Rohan Patil',
      email: `worker.${Date.now()}@workmatch.local`,
      password: 'DemoPassword123!',
      role: ROLES.WORKER
    });
    workerToken = workerReg.body.token;
    await User.findByIdAndUpdate(workerReg.body.user.id, { emailVerified: true });

    // 5. Setup Admin directly via model (since register endpoint forbids registering as admin)
    adminUser = await User.create({
      name: 'Platform Administrator',
      firstName: 'Platform',
      lastName: 'Administrator',
      email: `admin.${Date.now()}@workmatch.local`,
      passwordHash: 'dummy_hash',
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      activeRole: ROLES.ADMIN,
      emailVerified: true,
      accountStatus: 'active'
    });
    adminToken = signToken({ id: adminUser._id, role: ROLES.ADMIN, roles: [ROLES.ADMIN] });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Employer Job Creation & Publishing', () => {
    it('allows an authenticated and verified employer to publish a job without admin privileges (HTTP 201)', async () => {
      const workDate = getFutureDateString(3);
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Banquet Hall Service Assistant',
          description: 'Assist with evening guest hospitality and banquet table setups.',
          category: 'Wedding and catering support',
          locationName: 'Sanjay Ghodawat Institute, Atigre, Kolhapur',
          coordinates: [74.3720, 16.7410],
          workDate,
          workEndDate: workDate,
          startTime: '10:00',
          endTime: '18:00',
          breakDurationMinutes: 30,
          totalHours: 7.5,
          openings: 3,
          requiredSkills: ['Catering', 'Table Setup'],
          grossPay: 850,
          payBasis: 'shift',
          currency: 'INR',
          paymentMethod: 'Bank Transfer / Platform Recorded',
          status: JOB_STATUSES.OPEN
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job).toBeDefined();
      expect(res.body.job.title).toBe('Banquet Hall Service Assistant');
      expect(res.body.job.status).toBe(JOB_STATUSES.OPEN);
      expect(res.body.job.employer.toString()).toBe(employerUser.id.toString());
      expect(res.body.job.location.coordinates).toEqual([74.3720, 16.7410]);

      createdJobId = res.body.job._id;
    });

    it('allows the employer to edit their own job (HTTP 200)', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${createdJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Senior Banquet Hall Service Assistant',
          grossPay: 900,
          reason: 'Adjusted compensation for senior responsibility'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.title).toBe('Senior Banquet Hall Service Assistant');
      expect(res.body.job.grossPay).toBe(900);
    });

    it('allows the employer to cancel their own job (HTTP 200)', async () => {
      // First create a temporary job to cancel
      const workDate = getFutureDateString(4);
      const createRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Temporary Setup Role',
          description: 'Temporary shift to test cancellation.',
          category: 'Event assistance',
          locationName: 'Atigre, Kolhapur',
          coordinates: [74.3720, 16.7410],
          workDate,
          workEndDate: workDate,
          startTime: '11:00',
          endTime: '15:00',
          totalHours: 4,
          grossPay: 400,
          payBasis: 'hourly'
        });

      expect(createRes.status).toBe(201);
      const tempJobId = createRes.body.job._id;

      const cancelRes = await request(app)
        .post(`/api/jobs/${tempJobId}/cancel`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ reason: 'Event rescheduled by client' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);

      const checkJob = await Job.findById(tempJobId);
      expect(checkJob.status).toBe(JOB_STATUSES.CANCELLED);
    });
  });

  describe('2. Multi-Tenant Job Ownership Isolation', () => {
    it('prevents Employer 2 from editing Employer 1’s job (HTTP 403)', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${createdJobId}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({
          title: 'Illegally Hijacked Title'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized to edit/i);
    });

    it('prevents Employer 2 from cancelling Employer 1’s job (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/jobs/${createdJobId}/cancel`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({ reason: 'Malicious cancellation' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Worker Role Access Enforcement', () => {
    it('denies a worker from publishing a job with HTTP 403', async () => {
      const workDate = getFutureDateString(3);
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          title: 'Worker Trying To Publish Job',
          description: 'This attempt should fail authorization immediately.',
          category: 'Event assistance',
          locationName: 'Atigre, Kolhapur',
          coordinates: [74.3720, 16.7410],
          workDate,
          workEndDate: workDate,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 7.5,
          grossPay: 600
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/access denied/i);
    });

    it('denies a worker from editing a job with HTTP 403', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${createdJobId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ title: 'Hacked by Worker' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies a worker from cancelling a job with HTTP 403', async () => {
      const res = await request(app)
        .post(`/api/jobs/${createdJobId}/cancel`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ reason: 'Worker cancellation attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Email Verification Enforcement', () => {
    it('denies unverified employers from publishing jobs with EMAIL_VERIFICATION_REQUIRED (HTTP 403)', async () => {
      const workDate = getFutureDateString(3);
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${unverifiedEmployerToken}`)
        .send({
          title: 'Unverified Employer Shift',
          description: 'This should be blocked until email is verified.',
          category: 'Event assistance',
          locationName: 'Kolhapur',
          workDate,
          workEndDate: workDate,
          startTime: '10:00',
          endTime: '18:00',
          totalHours: 7.5,
          grossPay: 700
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });
  });

  describe('5. Administrator Management & Invariant Security', () => {
    it('allows genuine administrator access to administrative endpoints (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });

    it('strictly denies non-admin users attempting privilege escalation to admin endpoints (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/administrator privileges required/i);
    });
  });
});
