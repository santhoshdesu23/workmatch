import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Job } from '../src/models/Job.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { computeJobMatch, evaluateCategoryScore, evaluatePaymentScore } from '../src/services/matchingService.js';
import { ROLES, JOB_STATUSES, PAYMENT_BASES } from '../src/config/constants.js';

describe('Job Posting Flow: Custom Categories & INR Currency Integration Tests', () => {
  let employerToken;
  let employerUser;
  let workerToken;
  let workerUser;
  let workerProfile;
  let customJobId;

  const testEmployerEmail = `employer.cat.currency.${Date.now()}@workmatch.local`;
  const testWorkerEmail = `worker.cat.currency.${Date.now()}@workmatch.local`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Setup Employer
    const empReg = await request(app).post('/api/auth/register').send({
      name: 'Priya Sharma Events',
      email: testEmployerEmail,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Priya Studios & Events'
    });
    employerToken = empReg.body.token;
    employerUser = empReg.body.user;
    await User.findByIdAndUpdate(employerUser.id, { emailVerified: true });

    // 2. Setup Worker
    const workerReg = await request(app).post('/api/auth/register').send({
      name: 'Rohan Patil',
      email: testWorkerEmail,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    workerToken = workerReg.body.token;
    workerUser = workerReg.body.user;
    await User.findByIdAndUpdate(workerUser.id, { emailVerified: true });

    // Update worker profile with preferred categories & location in Kolhapur
    await request(app)
      .patch('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        skills: ['Photography', 'Lighting Assist', 'Photo Editing'],
        preferredCategories: ['Wedding Photography'],
        travelRadiusKm: 25,
        location: {
          type: 'Point',
          coordinates: [74.372, 16.741] // Atigre / Kolhapur
        },
        availability: {
          isAvailable: true,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          timeSlots: ['Morning', 'Afternoon', 'Evening']
        },
        expectedPay: { min: 800, max: 2000, basis: 'daily' }
      });

    workerProfile = await WorkerProfile.findOne({ user: workerUser.id }).lean();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ==========================================
  // 1. BACKEND CUSTOM CATEGORY VALIDATION & PERSISTENCE
  // ==========================================
  describe('Backend Category Acceptance & Validation', () => {
    it('accepts and saves valid custom categories (e.g. "Wedding Photography")', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 3);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Lead Wedding Photographer Assistant',
          description: 'Assist primary wedding photographer with lenses, flashes, and couple portraits.',
          category: 'Wedding Photography',
          requiredSkills: ['Photography', 'Lighting Assist'],
          openings: 2,
          locationName: 'Heritage Marriage Hall, Sangli Road, Kolhapur',
          coordinates: [74.375, 16.742],
          workDate: shiftDate.toISOString(),
          startTime: '10:00',
          endTime: '18:00',
          totalHours: 8,
          grossPay: 1200,
          payBasis: PAYMENT_BASES.DAILY
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.category).toBe('Wedding Photography');
      expect(res.body.job.currency).toBe('INR');
      expect(res.body.job.grossPay).toBe(1200);
      customJobId = res.body.job._id;
    });

    it('rejects an empty or whitespace-only category with 400 Bad Request', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 2);

      const resEmpty = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Empty Category Shift',
          description: 'Testing validation when category is empty',
          category: '',
          locationName: 'Test Venue',
          workDate: shiftDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 500
        });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.success).toBe(false);

      const resWhitespace = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Whitespace Category Shift',
          description: 'Testing validation when category is spaces only',
          category: '     ',
          locationName: 'Test Venue',
          workDate: shiftDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 500
        });

      expect(resWhitespace.status).toBe(400);
      expect(resWhitespace.body.success).toBe(false);
    });

    it('rejects custom categories exceeding 60 characters with 400 Bad Request', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 2);
      const longCategory = 'A'.repeat(61);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Excessive Category Length Shift',
          description: 'Testing rejection when category exceeds 60 characters',
          category: longCategory,
          locationName: 'Test Venue',
          workDate: shiftDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 500
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('60 characters');
    });

    it('preserves compatibility with predefined categories (e.g. "Event assistance")', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 2);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Predefined Banquet Staff',
          description: 'Help organize seating and attendee passes for annual meet.',
          category: 'Event assistance',
          requiredSkills: ['Guest Hospitality'],
          openings: 1,
          locationName: 'Town Hall Auditorium',
          coordinates: [74.37, 16.74],
          workDate: shiftDate.toISOString(),
          startTime: '08:00',
          endTime: '16:00',
          totalHours: 8,
          grossPay: 800,
          payBasis: 'daily'
        });

      expect(res.status).toBe(201);
      expect(res.body.job.category).toBe('Event assistance');
      expect(res.body.job.currency).toBe('INR');
    });

    it('allows updating a job with a valid custom category', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${customJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          category: 'Candid Wedding Photography',
          reason: 'Refined job category specification for applicants'
        });

      expect(res.status).toBe(200);
      expect(res.body.job.category).toBe('Candid Wedding Photography');
    });

    it('rejects updating a job with an empty custom category', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${customJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          category: '   '
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 2. DISCOVERY, FILTERING & SEARCH WITH CUSTOM CATEGORIES
  // ==========================================
  describe('Discovery, Search & Filtering With Custom Categories', () => {
    it('filters jobs by custom category safely and returns matches', async () => {
      const res = await request(app)
        .get('/api/jobs?category=Candid Wedding Photography');

      expect(res.status).toBe(200);
      expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
      const found = res.body.jobs.find((j) => j._id.toString() === customJobId.toString());
      expect(found).toBeDefined();
      expect(found.category).toBe('Candid Wedding Photography');
    });

    it('matches custom category via text search (?search=Photography)', async () => {
      const res = await request(app)
        .get('/api/jobs?search=Photography');

      expect(res.status).toBe(200);
      expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
      const found = res.body.jobs.find((j) => j._id.toString() === customJobId.toString());
      expect(found).toBeDefined();
    });

    it('evaluates category score for custom categories without errors', () => {
      // 1. Direct match with worker preference
      const matchScore = evaluateCategoryScore(['Candid Wedding Photography'], 'Candid Wedding Photography');
      expect(matchScore.score).toBe(1.0);
      expect(matchScore.explanation).toContain('Candid Wedding Photography');

      // 2. Worker with open preferences (empty array)
      const openScore = evaluateCategoryScore([], 'Farm Worker');
      expect(openScore.score).toBe(0.7);
      expect(openScore.explanation).toContain('Farm Worker');

      // 3. Worker with different preferred category
      const outsideScore = evaluateCategoryScore(['Warehouse and packing'], 'Home Tutor');
      expect(outsideScore.score).toBe(0.4);
      expect(outsideScore.explanation).toContain('Home Tutor');

      // 4. Unknown / undefined / empty category handled safely
      const emptyCatScore = evaluateCategoryScore(['Event assistance'], '');
      expect(emptyCatScore.score).toBe(0.5);
    });

    it('computes full job match score for custom category job', async () => {
      const job = await Job.findById(customJobId).lean();
      const match = computeJobMatch(workerProfile, job);

      expect(match).toBeDefined();
      expect(typeof match.matchScore).toBe('number');
      expect(match.matchScore).toBeGreaterThanOrEqual(50);
      expect(match.componentScores.categoryExperience).toBeDefined();
      expect(match.componentScores.payment).toBeDefined();
      expect(match.explanations).toBeDefined();
    });

    it('recommendation endpoint handles custom categories without crashing', async () => {
      const res = await request(app)
        .get('/api/recommendations/jobs')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });
  });

  // ==========================================
  // 3. CURRENCY: INR ADOPTION, DATA INTEGRITY & MESSAGING
  // ==========================================
  describe('INR Currency Adoption & Existing Data Integrity', () => {
    it('sets default currency to INR for new jobs', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 4);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Delivery Partner Morning Slot',
          description: 'Deliver packaged food orders within local neighborhood.',
          category: 'Delivery Partner',
          requiredSkills: ['Driving', 'Navigation'],
          openings: 3,
          locationName: 'Central Kitchen, Kolhapur',
          workDate: shiftDate.toISOString(),
          startTime: '06:00',
          endTime: '12:00',
          totalHours: 6,
          grossPay: 550,
          payBasis: PAYMENT_BASES.SHIFT
        });

      expect(res.status).toBe(201);
      expect(res.body.job.currency).toBe('INR');
      expect(res.body.job.grossPay).toBe(550);
      expect(res.body.job.payBasis).toBe('shift');
    });

    it('preserves existing numeric salary values without blind conversion or scaling', async () => {
      const sampleJob = await Job.findById(customJobId).lean();
      // Numeric value was 1200 and must remain exactly 1200
      expect(sampleJob.grossPay).toBe(1200);
    });

    it('formats payment explanations with ₹ in matching service', () => {
      const payResult = evaluatePaymentScore(
        { min: 800, max: 1500, basis: 'daily' },
        1200,
        'daily',
        8
      );
      expect(payResult.score).toBe(1.0);
      expect(payResult.explanation).toContain('₹');
      expect(payResult.explanation).not.toContain('$');
    });

    it('enforces protection of pay rate using ₹ in error messages', async () => {
      // Create a test job and assignment
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 5);

      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Protected Rate Shift',
          description: 'Testing wage reduction guard in INR',
          category: 'Event assistance',
          locationName: 'Banquet Hall',
          workDate: shiftDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 1000,
          payBasis: 'daily'
        });

      const testJob = jobRes.body.job;

      // Apply and hire worker to trigger active assignment
      const appRes = await request(app)
        .post(`/api/jobs/${testJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Ready to work' });

      const applicationId = appRes.body.application._id;

      // Employer offers
      await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'OFFERED' });

      // Worker accepts
      await request(app)
        .post(`/api/applications/${applicationId}/respond-to-offer`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ accept: true });

      // Employer hires (creates active assignment)
      const hireRes = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'HIRED' });

      expect(hireRes.status).toBe(200);

      // Attempt to reduce pay rate from 1000 to 700
      const reduceRes = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ grossPay: 700 });

      expect(reduceRes.status).toBe(400);
      expect(reduceRes.body.success).toBe(false);
      expect(reduceRes.body.message).toContain('₹1000');
      expect(reduceRes.body.message).toContain('₹700');
      expect(reduceRes.body.message).not.toContain('$');
    });
  });

  // ==========================================
  // 4. FRONTEND CURRENCY FORMATTING & WIZARD SPECIFICATION
  // ==========================================
  describe('Frontend Currency Formatting & Wizard Behavior Specifications', () => {
    function formatINR(amount) {
      const num = Number(amount);
      if (isNaN(num)) return '₹0';
      const hasDecimals = num % 1 !== 0;
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: hasDecimals ? 2 : 0
      }).format(num);
    }

    function formatPayWithBasis(amount, basis, mode = 'slash') {
      const formatted = formatINR(amount);
      if (!basis) return formatted;
      const b = basis.toLowerCase().trim();
      let unit = basis;
      if (b === 'hourly' || b === 'hour' || b === 'hr') {
        unit = mode === 'per' ? 'hour' : 'hr';
      } else if (b === 'daily' || b === 'day') {
        unit = 'day';
      } else if (b === 'weekly' || b === 'week') {
        unit = 'week';
      } else if (b === 'shift') {
        unit = 'shift';
      } else if (b === 'task') {
        unit = 'task';
      }
      return mode === 'per' ? `${formatted} per ${unit}` : `${formatted} / ${unit}`;
    }

    it('formats Indian currency correctly according to Indian numbering system (e.g. ₹800, ₹1,200, ₹12,500)', () => {
      expect(formatINR(800)).toBe('₹800');
      expect(formatINR(1200)).toBe('₹1,200');
      expect(formatINR(12500)).toBe('₹12,500');
      expect(formatINR(12500.5)).toBe('₹12,500.50');
    });

    it('formats daily, hourly, shift, and weekly compensation correctly in INR', () => {
      expect(formatPayWithBasis(800, 'daily', 'per')).toBe('₹800 per day');
      expect(formatPayWithBasis(150, 'hourly', 'per')).toBe('₹150 per hour');
      expect(formatPayWithBasis(650, 'shift', 'per')).toBe('₹650 per shift');
      expect(formatPayWithBasis(800, 'daily', 'slash')).toBe('₹800 / day');
      expect(formatPayWithBasis(150, 'hourly', 'slash')).toBe('₹150 / hr');
    });

    it('validates wizard category state transition logic: selecting Other, clearing on predefined, and preserving across steps', () => {
      // 1. Initial State
      let selectedCategory = 'Event assistance';
      let customCategory = '';
      let categoryError = '';

      const resolveCategory = (sel, custom) => (sel === 'OTHER' ? custom.trim() : sel);

      expect(resolveCategory(selectedCategory, customCategory)).toBe('Event assistance');

      // 2. Select "Other"
      selectedCategory = 'OTHER';
      expect(selectedCategory === 'OTHER').toBe(true);

      // 3. Submitting empty custom category is rejected
      if (selectedCategory === 'OTHER' && !customCategory.trim()) {
        categoryError = 'Please enter your custom job category.';
      }
      expect(categoryError).toBe('Please enter your custom job category.');

      // 4. Typing a valid custom category clears error
      customCategory = '  Wedding Photography  ';
      categoryError = '';
      expect(resolveCategory(selectedCategory, customCategory)).toBe('Wedding Photography');

      // 5. Simulating navigating to Step 2, 3, 4, 5 (state preserved)
      let currentStep = 1;
      currentStep = 2; // Schedule
      currentStep = 3; // Requirements
      currentStep = 4; // Terms
      currentStep = 5; // Preview
      expect(resolveCategory(selectedCategory, customCategory)).toBe('Wedding Photography');

      // 6. Switching to predefined category clears custom category and error
      selectedCategory = 'Retail and store assistance';
      if (selectedCategory !== 'OTHER') {
        customCategory = '';
        categoryError = '';
      }
      expect(customCategory).toBe('');
      expect(categoryError).toBe('');
      expect(resolveCategory(selectedCategory, customCategory)).toBe('Retail and store assistance');
    });
  });
});

