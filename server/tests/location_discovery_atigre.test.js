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
import { calculateDistanceKm, calculateDistanceKmPrecise, evaluateLocationScore, computeJobMatch } from '../src/services/matchingService.js';
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
  let radiusInsideJobId;
  let radiusBoundaryJobId;
  let radiusOutsideJobId;
  let radiusBoundaryKm;

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

    const origin = { lat: 16.741, lng: 74.372 };
    const offsetLatitude = (distanceKm) => origin.lat + (distanceKm / 6371) * (180 / Math.PI);
    const createRadiusFixture = (title, distanceKm) => {
      const latitude = offsetLatitude(distanceKm);
      return Job.create({
        employer: realEmployerId,
        title,
        description: 'Known-coordinate radius regression fixture.',
        category: 'Warehouse and packing',
        requiredSkills: ['Produce Sorting'],
        openings: 1,
        locationName: `Radius fixture ${title}`,
        locality: 'Radius Test Neighbor',
        city: 'Radius Test City',
        district: 'Radius Test District',
        state: 'Radius Test State',
        country: 'India',
        location: { type: 'Point', coordinates: [origin.lng, latitude] },
        workDate: new Date(Date.now() + 86400000),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 7.5,
        grossPay: 600,
        currency: 'INR',
        payBasis: PAYMENT_BASES.SHIFT,
        status: JOB_STATUSES.OPEN,
        isDemo: false
      });
    };
    const [insideFixture, boundaryFixture, outsideFixture] = await Promise.all([
      createRadiusFixture('Radius Inside 8 km', 8),
      createRadiusFixture('Radius Boundary 10 km', 10),
      createRadiusFixture('Radius Outside 15 km', 15)
    ]);
    radiusInsideJobId = insideFixture._id.toString();
    radiusBoundaryJobId = boundaryFixture._id.toString();
    radiusOutsideJobId = outsideFixture._id.toString();
    radiusBoundaryKm = calculateDistanceKmPrecise(
      origin.lat,
      origin.lng,
      boundaryFixture.location.coordinates[1],
      boundaryFixture.location.coordinates[0]
    );

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

  it('returns only jobs matching a typed locality and never broadens an unknown locality to all jobs', async () => {
    const localRes = await request(app).get('/api/jobs?location=Atigre').expect(200);
    expect(localRes.body.jobs.length).toBeGreaterThan(0);
    for (const job of localRes.body.jobs) {
      const locationText = [job.locality, job.city, job.district, job.state, job.locationName].filter(Boolean).join(' ');
      expect(locationText).toMatch(/Atigre/i);
    }

    const unknownRes = await request(app).get('/api/jobs?location=UnrecognizedTownXYZ').expect(200);
    expect(unknownRes.body.jobs).toEqual([]);
    expect(unknownRes.body.total).toBe(0);

    const compoundRes = await request(app).get('/api/jobs?location=Atigre%2C%20Kolhapur').expect(200);
    expect(compoundRes.body.jobs.length).toBeGreaterThan(0);
    for (const job of compoundRes.body.jobs) {
      expect([job.locality, job.city, job.district, job.state].join(' ')).toMatch(/Atigre/i);
      expect([job.locality, job.city, job.district, job.state].join(' ')).toMatch(/Kolhapur/i);
    }
  });

  it('includes inside and boundary jobs, excludes outside jobs, and includes nearby jobs from another locality', async () => {
    expect(radiusBoundaryKm).toBeCloseTo(10, 8);
    const res = await request(app)
      .get(`/api/jobs?locality=Atigre&lat=16.741&lng=74.372&maxDistanceKm=${radiusBoundaryKm}`)
      .expect(200);
    const ids = res.body.jobs.map((job) => job._id);
    expect(ids).toContain(radiusInsideJobId);
    expect(ids).toContain(radiusBoundaryJobId);
    expect(ids).toContain(realJobId);
    expect(ids).not.toContain(radiusOutsideJobId);
    expect(ids).not.toContain(nycJobId);
    expect(res.body.jobs.some((job) => job.isDemo)).toBe(true);
    expect(res.body.jobs.find((job) => job._id === radiusInsideJobId).locality).toBe('Radius Test Neighbor');
    for (const job of res.body.jobs) {
      const [jobLng, jobLat] = job.location.coordinates;
      expect(calculateDistanceKmPrecise(16.741, 74.372, jobLat, jobLng)).toBeLessThanOrEqual(radiusBoundaryKm);
    }
  });

  it('updates results when radius changes and excludes jobs with unknown coordinates', async () => {
    const withinTen = await request(app)
      .get('/api/jobs?lat=16.741&lng=74.372&maxDistanceKm=10')
      .expect(200);
    const tenKmIds = withinTen.body.jobs.map((job) => job._id);
    expect(tenKmIds).toContain(radiusInsideJobId);
    expect(tenKmIds).toContain(radiusBoundaryJobId);
    expect(tenKmIds).not.toContain(radiusOutsideJobId);
    expect(tenKmIds).not.toContain(missingCoordsJobId);

    const withinFive = await request(app)
      .get('/api/jobs?lat=16.741&lng=74.372&maxDistanceKm=5')
      .expect(200);
    const fiveKmIds = withinFive.body.jobs.map((job) => job._id);
    expect(fiveKmIds).not.toContain(radiusInsideJobId);
    expect(fiveKmIds).not.toContain(radiusBoundaryJobId);
    expect(fiveKmIds).not.toContain(radiusOutsideJobId);
  });

  it('rejects missing or invalid radius origins instead of returning all jobs', async () => {
    const missingOrigin = await request(app).get('/api/jobs?maxDistanceKm=10').expect(400);
    expect(missingOrigin.body.code).toBe('LOCATION_REQUIRED');

    const partialOrigin = await request(app).get('/api/jobs?lat=16.741&maxDistanceKm=10').expect(400);
    expect(partialOrigin.body.code).toBe('INVALID_LOCATION');

    const invalidOrigin = await request(app).get('/api/jobs?lat=100&lng=74.372&maxDistanceKm=10').expect(400);
    expect(invalidOrigin.body.code).toBe('INVALID_LOCATION');

    const sentinelOrigin = await request(app).get('/api/jobs?lat=0&lng=0&maxDistanceKm=10').expect(400);
    expect(sentinelOrigin.body.code).toBe('LOCATION_REQUIRED');
  });

  it('preserves category, keyword and pagination while applying exact location filters', async () => {
    const firstPage = await request(app)
      .get('/api/jobs?location=Atigre&category=Warehouse%20and%20packing&search=packing&page=1&limit=1')
      .expect(200);
    expect(firstPage.body.pagination.page).toBe(1);
    expect(firstPage.body.pagination.limit).toBe(1);
    expect(firstPage.body.jobs.length).toBeLessThanOrEqual(1);
    for (const job of firstPage.body.jobs) {
      expect(job.category).toBe('Warehouse and packing');
      const locationText = [job.locality, job.city, job.district, job.state, job.locationName].filter(Boolean).join(' ');
      expect(locationText).toMatch(/Atigre/i);
    }
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
