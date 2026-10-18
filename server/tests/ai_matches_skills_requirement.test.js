import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { ROLES, JOB_STATUSES } from '../src/config/constants.js';
import { computeJobMatch, sanitizeSkills } from '../src/services/matchingService.js';

describe('AI Matches Skills Requirement & Edge Cases Test Suite', () => {
  let employerToken;
  let employerId;
  let workerTokenNoSkills;
  let workerIdNoSkills;
  let workerTokenWithSkills;
  let workerIdWithSkills;
  let jobCateringId;
  let jobWeldingId;

  const timestamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Create Employer
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Match Test Employer',
      email: `match.emp.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Elite Events & Industrial'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;
    await User.findByIdAndUpdate(employerId, { emailVerified: true });

    // 2. Create Worker with NO skills (starts with default empty skills array)
    const worker1Res = await request(app).post('/api/auth/register').send({
      name: 'Unskilled Worker',
      email: `match.worker.noskills.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    workerTokenNoSkills = worker1Res.body.token;
    workerIdNoSkills = worker1Res.body.user.id;
    await User.findByIdAndUpdate(workerIdNoSkills, { emailVerified: true });

    // 3. Create Worker WITH specific skills (Catering Setup, Food Service)
    const worker2Res = await request(app).post('/api/auth/register').send({
      name: 'Skilled Catering Worker',
      email: `match.worker.skilled.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    workerTokenWithSkills = worker2Res.body.token;
    workerIdWithSkills = worker2Res.body.user.id;
    await User.findByIdAndUpdate(workerIdWithSkills, { emailVerified: true });

    await WorkerProfile.findOneAndUpdate(
      { user: workerIdWithSkills },
      {
        skills: ['Catering Setup', 'Food Service'],
        preferredCategories: ['Event assistance', 'Wedding and catering support'],
        experienceSummary: '3 years in high-end banquet setup'
      }
    );

    // 4. Create Job 1: Catering (Requires Catering Setup)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(10, 0, 0, 0);

    const job1Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Banquet Hall Setup Assistant',
        description: 'Assist with setting up chairs, tables, and tableware for evening gala banquet.',
        category: 'Event assistance',
        requiredSkills: ['Catering Setup'],
        openings: 3,
        locationName: 'Metropolitan Pavilion, NY',
        coordinates: [-73.99, 40.74],
        workDate: tomorrow.toISOString(),
        startTime: '10:00',
        endTime: '16:00',
        breakDurationMinutes: 30,
        totalHours: 6,
        grossPay: 28,
        payBasis: 'hourly',
        detailsConfirmed: true
      });
    jobCateringId = job1Res.body.job._id;

    // 5. Create Job 2: Welding / Industrial (Requires Certified Welder - unrelated to catering)
    const job2Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Industrial MIG Welder',
        description: 'Perform structural steel welding and fabrication in high-capacity shipyard.',
        category: 'Other lawful temporary work',
        requiredSkills: ['Certified Welder', 'Metal Fabrication'],
        openings: 2,
        locationName: 'Brooklyn Navy Yard, NY',
        coordinates: [-73.97, 40.70],
        workDate: tomorrow.toISOString(),
        startTime: '08:00',
        endTime: '16:00',
        breakDurationMinutes: 30,
        totalHours: 8,
        grossPay: 45,
        payBasis: 'hourly',
        detailsConfirmed: true
      });
    jobWeldingId = job2Res.body.job._id;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // Test 1: Worker has no skills: AI Matches returns no recommendations and prompts profile completion
  it('1. Worker has no skills: AI Matches returns no recommendations and prompts profile completion', async () => {
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenNoSkills}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.totalMatched).toBe(0);
    expect(res.body.requiresProfileCompletion).toBe(true);
    expect(res.body.hasSkills).toBe(false);
    expect(res.body.message).toContain('Add your skills');
  });

  // Test 2: Worker has an empty skills array explicitly
  it('2. Worker with explicit empty skills array [] receives no recommendations', async () => {
    await WorkerProfile.findOneAndUpdate({ user: workerIdNoSkills }, { skills: [] });

    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenNoSkills}`);

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.requiresProfileCompletion).toBe(true);
    expect(res.body.hasSkills).toBe(false);
  });

  // Test 3: Worker has a null, missing, or whitespace-only skills field
  it('3. Worker with null, undefined, or whitespace-only skills is handled safely', async () => {
    // Test whitespace-only array
    await WorkerProfile.findOneAndUpdate({ user: workerIdNoSkills }, { skills: ['   ', ' \t ', ''] });

    const resWhitespace = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenNoSkills}`);

    expect(resWhitespace.status).toBe(200);
    expect(resWhitespace.body.recommendations).toHaveLength(0);
    expect(resWhitespace.body.requiresProfileCompletion).toBe(true);
    expect(resWhitespace.body.hasSkills).toBe(false);

    // Test sanitizeSkills unit behavior
    expect(sanitizeSkills(null)).toEqual([]);
    expect(sanitizeSkills(undefined)).toEqual([]);
    expect(sanitizeSkills(['', '  ', '\n'])).toEqual([]);
    expect(sanitizeSkills([' Barista ', 'barista', 'BARISTA'])).toEqual(['Barista']);
    expect(sanitizeSkills([123, null, ' Cashier '])).toEqual(['Cashier']);
  });

  // Test 4: Worker has skills and relevant jobs exist
  it('4. Worker has skills and relevant jobs exist: returns matched jobs', async () => {
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenWithSkills}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresProfileCompletion).toBe(false);
    expect(res.body.hasSkills).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const cateringRec = res.body.recommendations.find((j) => j._id.toString() === jobCateringId.toString());
    expect(cateringRec).toBeDefined();
    expect(cateringRec.title).toBe('Banquet Hall Setup Assistant');
    expect(cateringRec.matchData.matchedSkills).toContain('Catering Setup');
    expect(cateringRec.matchData.matchScore).toBeGreaterThanOrEqual(40);
  });

  // Test 5: Worker has skills but no jobs match
  it('5. Worker has skills but no jobs match: returns empty recommendations with friendly message', async () => {
    // Update worker to have a completely unmatched skill
    await WorkerProfile.findOneAndUpdate(
      { user: workerIdWithSkills },
      { skills: ['Astronaut Pilot', 'Deep Sea Submarine Operator'] }
    );

    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenWithSkills}`);

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.totalMatched).toBe(0);
    expect(res.body.requiresProfileCompletion).toBe(false);
    expect(res.body.hasSkills).toBe(true);
    expect(res.body.message).toContain('No matching jobs found yet');

    // Restore skills for subsequent tests
    await WorkerProfile.findOneAndUpdate(
      { user: workerIdWithSkills },
      { skills: ['Catering Setup', 'Food Service'] }
    );
  });

  // Test 6: Jobs with unrelated skills are not returned as matches
  it('6. Jobs with unrelated skills are not returned as matches', async () => {
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenWithSkills}`);

    expect(res.status).toBe(200);
    // Worker has Catering Setup; Welding job requires Certified Welder
    const weldingJobRec = res.body.recommendations.find((j) => j._id.toString() === jobWeldingId.toString());
    expect(weldingJobRec).toBeUndefined();
  });

  // Test 7: The API does not fall back to returning all jobs
  it('7. The API does not fall back to returning all jobs when matching information is missing or unmatched', async () => {
    // Worker with no skills
    const resNoSkills = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerTokenNoSkills}`);

    expect(resNoSkills.body.recommendations).toHaveLength(0);

    // All jobs in system count >= 2
    const allJobsRes = await request(app).get('/api/jobs');
    expect(allJobsRes.body.jobs.length).toBeGreaterThanOrEqual(2);
  });

  // Test 8: Unauthorized requests cannot retrieve another worker's personalized matches
  it('8. Unauthorized requests cannot retrieve personalized matches', async () => {
    // Unauthenticated request
    const resUnauth = await request(app).get('/api/recommendations/jobs');
    expect(resUnauth.status).toBe(401);

    // Employer token (forbidden role)
    const resEmployer = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${employerToken}`);
    expect(resEmployer.status).toBe(403);
  });

  // Test 9: Normal job browsing still works independently of AI Matches
  it('9. Normal job browsing works independently for workers without skills', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerTokenNoSkills}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);
    // Unskilled worker can still discover both jobs through public browsing
    const titles = res.body.jobs.map((j) => j.title);
    expect(titles).toContain('Banquet Hall Setup Assistant');
    expect(titles).toContain('Industrial MIG Welder');
  });

  // Test 10: Existing matching behavior remains correct for valid profiles
  it('10. computeJobMatch unit calculation behaves correctly for valid profiles', () => {
    const mockWorker = {
      skills: ['Catering Setup'],
      location: { coordinates: [-73.99, 40.74] },
      travelRadiusKm: 25,
      availability: { isAvailable: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      expectedPay: { min: 25, basis: 'hourly' },
      preferredCategories: ['Event assistance']
    };

    const mockJob = {
      title: 'Banquet Hall Setup Assistant',
      category: 'Event assistance',
      requiredSkills: ['Catering Setup'],
      location: { coordinates: [-73.99, 40.74] },
      workDate: new Date().toISOString(),
      grossPay: 28,
      payBasis: 'hourly',
      totalHours: 6
    };

    const match = computeJobMatch(mockWorker, mockJob);
    expect(match.matchScore).toBeGreaterThanOrEqual(80);
    expect(match.matchedSkills).toContain('Catering Setup');
    expect(match.missingSkills).toHaveLength(0);
    expect(match.componentScores.skills).toBe(100);
  });
});
