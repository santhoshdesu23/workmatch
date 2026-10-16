import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES } from '../src/config/constants.js';

describe('Phase Ten: Complete End-to-End User Journeys', () => {
  let workerToken, workerUser;
  let employerToken, employerUser;
  let adminToken, adminUser;
  let createdJobId;
  let applicationId;
  let assignmentId;
  let paymentId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Seed admin
    const bcrypt = (await import('bcryptjs')).default;
    const adminPass = await bcrypt.hash('AdminSecure2026!', 12);
    adminUser = await User.create({
      name: 'System Moderation Admin',
      email: `admin.e2e.${Date.now()}@workmatch.local`,
      passwordHash: adminPass,
      role: ROLES.ADMIN,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });

    const aLogin = await request(app).post('/api/auth/login').send({
      email: adminUser.email,
      password: 'AdminSecure2026!'
    });
    adminToken = aLogin.body.token;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ==========================================
  // JOURNEY 1: EMPLOYER LIFECYCLE
  // ==========================================
  describe('Journey 1: Employer Posts Job, Manages Applicants, and Hires', () => {
    it('Employer registers and logs in', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Clara Event Director',
        email: `clara.emp.${Date.now()}@workmatch.local`,
        password: 'Password123!',
        role: 'employer',
        businessName: 'Clara Grand Catering'
      });
      expect(reg.status).toBe(201);
      employerToken = reg.body.token;
      employerUser = reg.body.user;

      const profileRes = await request(app)
        .get('/api/employers/me')
        .set('Authorization', `Bearer ${employerToken}`);
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.profile.businessName).toBe('Clara Grand Catering');
    });

    it('Employer creates and publishes temporary banquet staff job', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 5);

      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Senior Banquet Captain',
          description: 'Lead banquet serving team for high-profile gala dinner',
          category: 'Event assistance',
          requiredSkills: ['Banquet Service', 'Team Leadership', 'Customer Care'],
          openings: 1,
          locationName: 'Metropolitan Gala Center',
          coordinates: [-73.985, 40.748],
          workDate: shiftDate.toISOString(),
          startTime: '14:00',
          endTime: '22:00',
          totalHours: 8,
          grossPay: 35,
          payBasis: 'hourly'
        });

      expect(jobRes.status).toBe(201);
      expect(jobRes.body.job.status).toBe(JOB_STATUSES.OPEN);
      createdJobId = jobRes.body.job._id;
    });
  });

  // ==========================================
  // JOURNEY 2: WORKER LIFECYCLE
  // ==========================================
  describe('Journey 2: Worker Discovers Job, Applies, Gets Hired, Confirms Completion, and Reviews', () => {
    it('Worker registers, completes profile and availability', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'David Banquet Lead',
        email: `david.worker.${Date.now()}@workmatch.local`,
        password: 'Password123!',
        role: 'worker'
      });
      expect(reg.status).toBe(201);
      workerToken = reg.body.token;
      workerUser = reg.body.user;

      // Update worker profile
      const profUpdate = await request(app)
        .patch('/api/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          skills: ['Banquet Service', 'Team Leadership', 'Fine Dining'],
          preferredCategories: ['Event assistance'],
          travelRadiusKm: 30,
          expectedPay: { min: 30, max: 45, basis: 'hourly' }
        });
      expect(profUpdate.status).toBe(200);
    });

    it('Worker discovers published jobs and receives transparent explainable match scores', async () => {
      const res = await request(app)
        .get(`/api/jobs/${createdJobId}`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe('Senior Banquet Captain');
      expect(res.body.job.matchData).toBeDefined();
      expect(res.body.job.matchData.matchScore).toBeGreaterThanOrEqual(70);
      expect(res.body.job.matchData.matchedSkills).toContain('Banquet Service');
    });

    it('Worker submits voluntary application', async () => {
      const res = await request(app)
        .post(`/api/jobs/${createdJobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Over 6 years leading banquet service teams.' });

      expect(res.status).toBe(201);
      expect(res.body.application.status).toBe(APPLICATION_STATUSES.APPLIED);
      applicationId = res.body.application._id;
    });

    it('Employer inspects applicants with computed match ratings, shortlists, and sends offer', async () => {
      // 1. View applicants
      const listRes = await request(app)
        .get(`/api/jobs/${createdJobId}/applications`)
        .set('Authorization', `Bearer ${employerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.applicants.length).toBe(1);

      // 2. Shortlist
      const shortRes = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: APPLICATION_STATUSES.SHORTLISTED, note: 'Impressive leadership profile' });
      expect(shortRes.status).toBe(200);

      // 3. Extend offer
      const offerRes = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: APPLICATION_STATUSES.OFFERED,
          note: 'Offer extended: Senior Banquet Captain shift',
          offerDetails: { note: 'Please confirm shift timing by tomorrow.' }
        });
      expect(offerRes.status).toBe(200);
    });

    it('Worker accepts offer and Employer confirms hire', async () => {
      // Worker accepts
      const acceptRes = await request(app)
        .post(`/api/applications/${applicationId}/respond-to-offer`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ accept: true });
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.application.status).toBe(APPLICATION_STATUSES.ACCEPTED);

      // Employer confirms hire
      const hireRes = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: APPLICATION_STATUSES.HIRED, note: 'Confirmed hire for gala' });
      expect(hireRes.status).toBe(200);
      expect(hireRes.body.application.status).toBe(APPLICATION_STATUSES.HIRED);
    });

    it('Worker inspects active assignment and payment records', async () => {
      const assignRes = await request(app)
        .get('/api/assignments/me')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.assignments.length).toBe(1);
      assignmentId = assignRes.body.assignments[0]._id;
      expect(assignRes.body.assignments[0].status).toBe(ASSIGNMENT_STATUSES.CONFIRMED);

      const payRes = await request(app)
        .get('/api/payments/me')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(payRes.status).toBe(200);
      expect(payRes.body.payments.length).toBe(1);
      paymentId = payRes.body.payments[0]._id;
      expect(payRes.body.payments[0].status).toBe(PAYMENT_STATUSES.DUE);
    });

    it('Both parties confirm completion -> Assignment becomes COMPLETED', async () => {
      // Worker confirms completion
      const wConf = await request(app)
        .post(`/api/assignments/${assignmentId}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(wConf.status).toBe(200);

      // Employer confirms completion
      const eConf = await request(app)
        .post(`/api/assignments/${assignmentId}/confirm-completion`)
        .set('Authorization', `Bearer ${employerToken}`);
      expect(eConf.status).toBe(200);
      expect(eConf.body.assignment.status).toBe(ASSIGNMENT_STATUSES.COMPLETED);
    });

    it('Employer records payment and Worker confirms receipt of funds', async () => {
      // Employer updates payment to PAID
      const payUpdate = await request(app)
        .patch(`/api/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: PAYMENT_STATUSES.PAID,
          paymentMethod: 'Instant ACH',
          providerReference: 'ACH-WORKMATCH-99214',
          note: 'Funds transferred'
        });
      expect(payUpdate.status).toBe(200);
      expect(payUpdate.body.payment.status).toBe(PAYMENT_STATUSES.PAID);
      expect(payUpdate.body.payment.verificationSource).toBe('employer_recorded');

      // Worker confirms receipt
      const receiptRes = await request(app)
        .post(`/api/payments/${paymentId}/confirm-receipt`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(receiptRes.status).toBe(200);
      expect(receiptRes.body.payment.workerConfirmedReceipt).toBe(true);
      expect(receiptRes.body.payment.verificationSource).toBe('worker_confirmed');
    });

    it('Worker submits eligible review for completed assignment', async () => {
      const revRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          assignmentId,
          rating: 5,
          reviewText: 'Outstanding coordination, timely payout, professional staff.'
        });
      expect(revRes.status).toBe(201);
      expect(revRes.body.review.rating).toBe(5);
    });
  });

  // ==========================================
  // JOURNEY 3: ADMINISTRATOR MODERATION
  // ==========================================
  describe('Journey 3: Administrator Moderation & Safety Workflows', () => {
    it('Admin views platform analytics dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalUsers).toBeGreaterThanOrEqual(3);
      expect(res.body.stats.totalJobs).toBeGreaterThanOrEqual(1);
      expect(res.body.stats.completedAssignments).toBeGreaterThanOrEqual(1);
    });

    it('Worker submits verification request and Admin approves verification', async () => {
      // Worker submits verification
      const subRes = await request(app)
        .post('/api/auth/verification-request')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          verificationType: 'identity',
          submittedData: {
            documentType: 'Passport',
            documentRef: 'USA-PASS-88419'
          }
        });
      expect(subRes.status).toBe(201);
      const vId = subRes.body.verification._id;

      // Admin approves verification
      const appRes = await request(app)
        .patch(`/api/admin/verifications/${vId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', reviewNotes: 'Government photo ID verified.' });

      expect(appRes.status).toBe(200);
      expect(appRes.body.verification.status).toBe('approved');
    });

    it('User submits trust & safety report, and Admin resolves it', async () => {
      // Worker reports an issue
      const repRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          category: 'unsafe_conditions',
          description: 'Spill hazard on kitchen loading dock noted during shift.'
        });
      expect(repRes.status).toBe(201);
      const repId = repRes.body.report._id;

      // Admin resolves report
      const resRes = await request(app)
        .patch(`/api/admin/reports/${repId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved', resolutionNotes: 'Facility maintenance alerted and resolved hazard.' });

      expect(resRes.status).toBe(200);
      expect(resRes.body.report.status).toBe('resolved');
    });
  });
});
