import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Application } from '../src/models/Application.js';
import { ROLES, JOB_STATUSES, PAYMENT_BASES } from '../src/config/constants.js';
import { calculateDistanceKm, evaluateLocationScore, computeJobMatch } from '../src/services/matchingService.js';
import { seedAtigreKolhapurJobs } from '../scripts/seed_atigre_kolhapur_jobs.js';
import { backupAndCleanupJobs } from '../scripts/backup_and_cleanup_jobs.js';

describe('Location-Based Job Discovery & Atigre/Kolhapur Test Suite', () => {
  let atigreWorkerToken;
  let atigreWorkerId;
  let realEmployerToken;
  let realEmployerId;
  let realJobId;
  let nycJobId;
  let missingCoordsJobId;

  const timestamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI; // Use in-memory MongoDB
    await connectDB();

    // 1. Register a real employer
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Genuine Local Business Owner',
      email: `real.employer.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Kolhapur Organic Farms'
    });
    realEmployerId = empRes.body.user.id;
    await User.findByIdAndUpdate(realEmployerId, { emailVerified: true });

    // 2. Register worker located in Atigre
    const workerRes = await request(app).post('/api/auth/register').send({
      name: 'Atigre Local Worker',
      email: `worker.atigre.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    atigreWorkerId = workerRes.body.user.id;
    await User.findByIdAndUpdate(atigreWorkerId, { emailVerified: true });

    // Authenticate clean session for worker
    const loginRes = await request(app).post('/api/auth/login').send({
      email: `worker.atigre.${timestamp}@example.com`,
      password: 'Password123!'
    });
    atigreWorkerToken = loginRes.body.token;

    // Setup worker profile with skills and Atigre coordinates [lng, lat] = [74.3720, 16.7410]
    await WorkerProfile.findOneAndUpdate(
      { user: atigreWorkerId },
      {
        $set: {
          skills: ['Produce Sorting', 'Box Packing', 'Catering Setup'],
          location: { type: 'Point', coordinates: [74.3720, 16.7410] }, // Atigre
          preferredLocationName: 'Atigre, Hatkanangale, Kolhapur',
          travelRadiusKm: 20,
          expectedPay: { min: 400, max: 1000, basis: 'daily' },
          availability: { isAvailable: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], timeSlots: ['Morning', 'Afternoon'] }
        }
      },
      { upsert: true }
    );

    // 3. Post a genuine employer job in Kolhapur
    const realJob = await Job.create({
      employer: realEmployerId,
      title: 'Genuine Farm Dispatch Assistant',
      description: 'Real agricultural dispatch shift posted by confirmed employer.',
      category: 'Warehouse and packing',
      requiredSkills: ['Produce Sorting'],
      openings: 2,
      locationName: 'Shiroli Road Farm, Kolhapur, Maharashtra',
      locality: 'Shiroli MIDC',
      city: 'Kolhapur',
      district: 'Kolhapur',
      state: 'Maharashtra',
      country: 'India',
      location: { type: 'Point', coordinates: [74.3015, 16.7482] },
      workDate: new Date(Date.now() + 86400000),
      startTime: '08:00',
      endTime: '16:00',
      totalHours: 7.5,
      grossPay: 800,
      currency: 'INR',
      payBasis: PAYMENT_BASES.SHIFT,
      status: JOB_STATUSES.OPEN,
      isDemo: false
    });
    realJobId = realJob._id.toString();

    // 4. Create an application for the real job
    await Application.create({
      job: realJobId,
      worker: atigreWorkerId,
      status: 'APPLIED',
      message: 'Interested in this local shift.'
    });

    // 5. Create a disposable New York demo job
    const nycJob = await Job.create({
      employer: realEmployerId,
      seedId: 'nyc-test-seed',
      title: 'Banquet Guest Check-in & Registration Assistant',
      description: 'New York Javits Center shift.',
      category: 'Event assistance',
      requiredSkills: ['Produce Sorting'],
      openings: 2,
      locationName: 'Javits Center, 429 11th Ave, New York, NY 10001',
      locality: 'Manhattan',
      city: 'New York',
      state: 'New York',
      country: 'USA',
      location: { type: 'Point', coordinates: [-74.002, 40.757] }, // NYC Midtown
      workDate: new Date(Date.now() + 86400000),
      startTime: '09:00',
      endTime: '17:00',
      totalHours: 7.5,
      grossPay: 26,
      currency: 'USD',
      payBasis: PAYMENT_BASES.HOURLY,
      status: JOB_STATUSES.OPEN,
      isDemo: true
    });
    nycJobId = nycJob._id.toString();

    // 6. Create a job with uncalibrated coordinates
    const missingCoordsJob = await Job.create({
      employer: realEmployerId,
      title: 'Uncalibrated Coordinates Office Shift',
      description: 'Job with uncalibrated coordinates.',
      category: 'Data entry and office assistance',
      requiredSkills: ['Data Entry'],
      openings: 1,
      locationName: 'Hatkanangale Central Office',
      locality: 'HatkanangaleUncalibrated',
      city: 'HatkanangaleSpecialCity',
      location: { type: 'Point', coordinates: [0, 0] }, // uncalibrated
      workDate: new Date(Date.now() + 86400000),
      startTime: '10:00',
      endTime: '18:00',
      totalHours: 7.5,
      grossPay: 600,
      currency: 'INR',
      status: JOB_STATUSES.OPEN
    });
    missingCoordsJobId = missingCoordsJob._id.toString();

    // 7. Seed local Atigre/Kolhapur demo jobs
    await seedAtigreKolhapurJobs({ verbose: false });
  }, 30000);

  afterAll(async () => {
    await disconnectDB();
  });

  // Test 1: Atigre search returns eligible local demo listings
  it('1. Atigre search returns eligible local demo listings within 10 km', async () => {
    // Atigre coordinates: 16.7410, 74.3720
    const res = await request(app)
      .get('/api/jobs?lat=16.7410&lng=74.3720&maxDistanceKm=10')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThan(0);

    // Every returned job must have a reliably calculated distance <= 10 km
    for (const job of res.body.jobs) {
      expect(job.distanceKm).not.toBeNull();
      expect(job.distanceKm).toBeLessThanOrEqual(10);
    }

    // Should include Atigre, Hatkanangale, or Shiroli MIDC jobs (which are within 10 km)
    const localities = res.body.jobs.map(j => j.locality);
    expect(localities.some(l => ['Atigre', 'Hatkanangale', 'Shiroli MIDC'].includes(l))).toBe(true);
  });

  // Test 2: A New York job is excluded from Atigre radius-filtered results
  it('2. A New York job (~12,500 km away) is strictly excluded from Atigre radius-filtered results', async () => {
    const res = await request(app)
      .get('/api/jobs?lat=16.7410&lng=74.3720&maxDistanceKm=50')
      .expect(200);

    expect(res.body.success).toBe(true);
    const jobIds = res.body.jobs.map(j => j._id);
    expect(jobIds).not.toContain(nycJobId);

    // Verify distance from Atigre to NYC is indeed ~12,500 km
    const distToNyc = calculateDistanceKm(16.7410, 74.3720, 40.757, -74.002);
    expect(distToNyc).toBeGreaterThan(12000);
  });

  // Test 3: A job with missing coordinates is handled safely
  it('3. A job with missing/uncalibrated coordinates ([0, 0]) is handled safely without crashing and excluded from radius filter', async () => {
    // Distance should be null
    const dist = calculateDistanceKm(16.7410, 74.3720, 0, 0);
    expect(dist).toBeNull();

    // In radius search, it must be excluded because it cannot be proven nearby
    const radiusRes = await request(app)
      .get('/api/jobs?lat=16.7410&lng=74.3720&maxDistanceKm=25')
      .expect(200);

    const radiusIds = radiusRes.body.jobs.map(j => j._id);
    expect(radiusIds).not.toContain(missingCoordsJobId);

    // Without radius filter, it can still be found safely by city or text search
    const browseRes = await request(app)
      .get('/api/jobs?city=HatkanangaleSpecialCity')
      .expect(200);

    const browseIds = browseRes.body.jobs.map(j => j._id);
    expect(browseIds).toContain(missingCoordsJobId);
  });

  // Test 4: Location matching does not confuse similarly named places in different countries
  it('4. Location matching distinguishes countries and states properly', async () => {
    const indiaRes = await request(app)
      .get('/api/jobs?location=Kolhapur')
      .expect(200);

    expect(indiaRes.body.success).toBe(true);
    for (const job of indiaRes.body.jobs) {
      expect(job.country).not.toBe('USA');
      const matchesText =
        (job.locality && /kolhapur/i.test(job.locality)) ||
        (job.city && /kolhapur/i.test(job.city)) ||
        (job.district && /kolhapur/i.test(job.district)) ||
        (job.locationName && /kolhapur/i.test(job.locationName));
      expect(matchesText).toBe(true);
    }
  });

  // Test 5: Search still works without a location filter
  it('5. Search still works without a location filter (general job browsing)', async () => {
    const res = await request(app)
      .get('/api/jobs?limit=10')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThan(0);
    expect(res.body.total || res.body.pagination?.total).toBeGreaterThanOrEqual(26);
  });

  // Test 6: Category, keyword, date, and location filters work together
  it('6. Category, keyword, and location filters work together cohesively', async () => {
    const res = await request(app)
      .get('/api/jobs?category=Warehouse+and+packing&search=packing&lat=16.7410&lng=74.3720&maxDistanceKm=20')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThan(0);

    for (const job of res.body.jobs) {
      expect(job.category).toBe('Warehouse and packing');
      expect(job.distanceKm).toBeLessThanOrEqual(20);
      const hasKeyword =
        job.title.toLowerCase().includes('packing') ||
        job.description.toLowerCase().includes('packing') ||
        job.requiredSkills.some(s => s.toLowerCase().includes('packing'));
      expect(hasKeyword).toBe(true);
    }
  });

  // Test 7: Running the seed script twice does not create duplicates (idempotency)
  it('7. Running the seed script twice does not create duplicates (idempotent upsert)', async () => {
    const initialJobs = await Job.find({ isDemo: true, seedId: { $regex: /^demo-/ } });
    expect(initialJobs.length).toBe(26);

    // Run seed again
    const seedResult = await seedAtigreKolhapurJobs({ verbose: false });
    expect(seedResult.createdCount).toBe(0);
    expect(seedResult.updatedCount).toBe(26);

    const postRerunJobs = await Job.find({ isDemo: true, seedId: { $regex: /^demo-/ } });
    expect(postRerunJobs.length).toBe(26); // exactly 26, no duplicates
  });

  // Test 8: Real employer listings and their applications remain untouched
  it('8. Real employer listings and their applications remain completely untouched during cleanup', async () => {
    // Run cleanup
    const cleanupResult = await backupAndCleanupJobs();
    expect(cleanupResult.deletedCount).toBeGreaterThanOrEqual(1); // deleted the nycJob

    // Check real job is intact
    const preservedRealJob = await Job.findById(realJobId);
    expect(preservedRealJob).not.toBeNull();
    expect(preservedRealJob.title).toBe('Genuine Farm Dispatch Assistant');

    // Check real application is intact
    const preservedApp = await Application.findOne({ job: realJobId, worker: atigreWorkerId });
    expect(preservedApp).not.toBeNull();
    expect(preservedApp.status).toBe('APPLIED');
  });

  // Test 9: Featured shifts never falsely claim to be nearby
  it('9. Browse/featured shifts return distanceKm as null when user coordinates are not supplied', async () => {
    const res = await request(app)
      .get('/api/jobs?limit=4&sort=recent')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.jobs.length).toBeLessThanOrEqual(4);

    // When no lat/lng are provided in query or user session, distanceKm MUST be null (never fake)
    for (const job of res.body.jobs) {
      expect(job.distanceKm).toBeNull();
    }
  });

  // Test 10: AI Matches obeys the selected location and worker skill requirements
  it('10. AI Matches obeys worker location in Atigre and rejects distant jobs', async () => {
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${atigreWorkerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    // Every recommendation for the Atigre worker must be geographically compatible
    for (const rec of res.body.recommendations) {
      if (rec.matchData?.distanceKm !== null && rec.matchData?.distanceKm !== undefined) {
        // Must be within acceptable travel boundary (< 50 km)
        expect(rec.matchData.distanceKm).toBeLessThanOrEqual(50);
      }
      // Must match at least one required skill if required skills exist
      if (rec.requiredSkills && rec.requiredSkills.length > 0) {
        expect(rec.matchData.matchedSkills.length).toBeGreaterThan(0);
      }
    }

    // Verify evaluateLocationScore assigns 0 score for excessive distance (> 100 km)
    const atigreLocation = { type: 'Point', coordinates: [74.3720, 16.7410] };
    const nycLocation = { type: 'Point', coordinates: [-74.002, 40.757] };
    const locScore = evaluateLocationScore(atigreLocation, nycLocation, 25);

    expect(locScore.score).toBe(0.0);
    expect(locScore.distanceKm).toBeGreaterThan(12000);
    expect(locScore.explanation).toContain('far outside');
  });
});
