import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { computeJobMatch, calculateDistanceKm } from '../src/services/matchingService.js';
import { aiExplanationService } from '../src/services/aiExplanationService.js';
import { User } from '../src/models/User.js';

describe('WorkMatch Core API & Matching Engine Test Suite', () => {
  let workerToken;
  let employerToken;
  let workerId;
  let testJobId;
  const testWorkerEmail = `test.worker.${Date.now()}@example.com`;
  const testEmployerEmail = `test.employer.${Date.now()}@example.com`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Health Check', () => {
    it('GET /api/health should return healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('WorkMatch API Server');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should register a new worker account', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Unit Test Worker',
        email: testWorkerEmail,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('worker');

      workerToken = res.body.token;
      workerId = res.body.user.id;
    });

    it('should prevent duplicate email registration', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate Worker',
        email: testWorkerEmail,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should register a new employer account', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Unit Test Employer',
        email: testEmployerEmail,
        password: 'Password123!',
        role: 'employer',
        businessName: 'Acme Test Operations'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('employer');

      employerToken = res.body.token;
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testWorkerEmail,
        password: 'WrongPassword999!'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should authenticate user and return /api/auth/me profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testWorkerEmail);
      expect(res.body.user.profile).toBeDefined();
    });
  });

  describe('Jobs Marketplace Lifecycle', () => {
    beforeAll(async () => {
      await User.updateMany(
        { email: { $in: [testWorkerEmail, testEmployerEmail] } },
        { $set: { emailVerified: true } }
      );
    });

    it('employer should create a new temporary job', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Unit Test Banquet Setup Staff',
          description: 'Help assemble tables and chairs for a conference',
          category: 'Event assistance',
          requiredSkills: ['Catering Setup', 'Heavy Lifting'],
          openings: 2,
          locationName: 'Test Convention Center',
          coordinates: [-74.0, 40.7],
          workDate: tomorrow.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 25,
          payBasis: 'hourly'
        });

      expect(res.status).toBe(201);
      expect(res.body.job).toBeDefined();
      expect(res.body.job.title).toBe('Unit Test Banquet Setup Staff');
      testJobId = res.body.job._id;
    });

    it('worker should discover jobs via public endpoint', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.jobs)).toBe(true);
      expect(res.body.jobs.length).toBeGreaterThan(0);
    });

    it('worker should voluntarily apply to job', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          message: 'I have extensive experience with banquet setup.'
        });

      expect(res.status).toBe(201);
      expect(res.body.application).toBeDefined();
      expect(res.body.application.status).toBe('APPLIED');
    });

    it('should reject duplicate applications for same job by same worker', async () => {
      const res = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying second time' });

      expect(res.status).toBe(409);
    });

    it('employer should view applicant list with compatibility data', async () => {
      const res = await request(app)
        .get(`/api/jobs/${testJobId}/applications`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.applicants.length).toBe(1);
      expect(res.body.applicants[0].worker.email).toBeDefined();
    });
  });

  describe('Explainable AI Matching Algorithm Unit Checks', () => {
    it('Haversine distance calculation is accurate', () => {
      // Distance between Midtown NYC (40.75, -73.98) and Downtown Brooklyn (40.69, -73.99) is ~6.7 km
      const dist = calculateDistanceKm(40.75, -73.98, 40.69, -73.99);
      expect(dist).toBeGreaterThan(6.0);
      expect(dist).toBeLessThan(7.5);
    });

    it('computes transparent match score with breakdown and explanations', () => {
      const mockProfile = {
        skills: ['Catering Setup', 'Food Handling'],
        preferredCategories: ['Event assistance'],
        location: { coordinates: [-73.98, 40.75] },
        travelRadiusKm: 25,
        availability: {
          isAvailable: true,
          days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          timeSlots: ['Morning', 'Afternoon']
        },
        expectedPay: { min: 20, max: 30, basis: 'hourly' }
      };

      const mockJob = {
        requiredSkills: ['Catering Setup'],
        category: 'Event assistance',
        location: { coordinates: [-73.99, 40.69] },
        workDate: new Date().toISOString(),
        startTime: '10:00',
        endTime: '15:00',
        totalHours: 5,
        grossPay: 25,
        payBasis: 'hourly'
      };

      const match = computeJobMatch(mockProfile, mockJob);
      expect(match.matchScore).toBeGreaterThanOrEqual(70);
      expect(match.matchedSkills).toContain('Catering Setup');
      expect(match.explanations.length).toBe(5);
      expect(match.componentScores.skills).toBe(100);
    });

    it('deterministic fallback explanation provider works without API key', async () => {
      const fallbackResult = aiExplanationService.getLocalDeterministicExplanation(
        { skills: ['Catering Setup'] },
        { title: 'Banquet Setup', grossPay: 25 },
        { matchScore: 88, matchedSkills: ['Catering Setup'], distanceKm: 5, componentScores: { payment: 90 } }
      );

      expect(fallbackResult.source).toBe('local-explainable-engine');
      expect(fallbackResult.explanation).toContain('88%');
    });
  });

  describe('Security & Admin Role Safeguards', () => {
    it('should reject non-admin access to admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated access to admin endpoints', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });
  });
});
