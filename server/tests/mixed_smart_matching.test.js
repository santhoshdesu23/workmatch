import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { ROLES, JOB_STATUSES } from '../src/config/constants.js';
import {
  areSkillsMatching,
  calculateJobHours,
  classifyJobMatch,
  partitionMixedJobMatches,
  evaluateLocationScore,
  evaluatePaymentScore,
  evaluateCategoryScore,
  REQUIREMENT_TYPES,
  PROVENANCE_SOURCES,
  MATCH_TYPES
} from '../src/services/matchingService.js';
import { aiExplanationService } from '../src/services/aiExplanationService.js';

describe('Mixed Smart Matching Engine Test Suite', () => {
  let employerToken;
  let employerId;
  let workerToken;
  let workerId;
  let skilledWorkerProfile;
  const timestamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Register Employer
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Match Test Employer',
      email: `mixed.match.emp.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Grand Hyatt Events'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;
    await User.findByIdAndUpdate(employerId, { emailVerified: true });

    // Register Worker
    const wrkRes = await request(app).post('/api/auth/register').send({
      name: 'Alex Rivera',
      email: `mixed.match.worker.${timestamp}@example.com`,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    workerToken = wrkRes.body.token;
    workerId = wrkRes.body.user.id;
    await User.findByIdAndUpdate(workerId, { emailVerified: true });

    // Configure Worker Profile
    // Location: Atigre (16.7410, 74.3720), Preferred category: Restaurant and hospitality
    skilledWorkerProfile = await WorkerProfile.findOneAndUpdate(
      { user: workerId },
      {
        skills: ['Server', 'Food Service'],
        preferredCategories: ['Restaurant and hospitality'],
        location: {
          type: 'Point',
          coordinates: [74.3720, 16.7410] // [lng, lat]
        },
        travelRadiusKm: 15,
        expectedPay: {
          min: 300,
          max: 600,
          basis: 'hourly'
        },
        availability: {
          isAvailable: true,
          days: ['Friday', 'Saturday', 'Sunday'],
          timeSlots: ['Evening', 'Night']
        }
      },
      { new: true }
    ).lean();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ==========================================
  // SCENARIO 1: Exact match satisfaction
  // ==========================================
  it('1. Exact Match: qualifies when all hard constraints and all soft preferences are met', () => {
    const nextFriday = new Date();
    // Advance to upcoming Friday
    nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));
    nextFriday.setHours(18, 0, 0, 0);

    const job = {
      _id: 'job_exact_1',
      title: 'Fine Dining Banquet Server',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 5,
      filledCount: 1,
      requiredSkills: ['waiter'], // matches 'Server' via canonical alias!
      grossPay: 350,
      payBasis: 'hourly',
      workDate: nextFriday.toISOString(),
      startTime: '18:00',
      endTime: '23:00',
      totalHours: 5,
      location: {
        type: 'Point',
        coordinates: [74.3800, 16.7450] // ~1 km from worker
      },
      applicationDeadline: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile,
      filters: {},
      now: new Date()
    });

    expect(res.eligible).toBe(true);
    expect(res.matchType).toBe(MATCH_TYPES.EXACT);
    expect(res.matchScore).toBeGreaterThanOrEqual(85);
    expect(res.preferenceDifferences).toHaveLength(0);
    expect(res.matchedSkills).toContain('waiter');
  });

  // ==========================================
  // SCENARIO 2: Hard requirement rejection - Category mismatch
  // ==========================================
  it('2. Hard Requirement Rejection: explicit category filter excludes non-matching jobs from all tiers', () => {
    const job = {
      title: 'Warehouse Loader',
      category: 'Warehouse and packing',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile,
      filters: { category: 'Restaurant and hospitality' }
    });

    expect(res.eligible).toBe(false);
    expect(res.matchType).toBeNull();
    expect(res.rejectionReasons.some((r) => r.includes('Category mismatch'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 3: Hard requirement rejection - Min pay violated
  // ==========================================
  it('3. Hard Requirement Rejection: explicit minPay filter excludes underpaying jobs', () => {
    const job = {
      title: 'Event Helper',
      category: 'Event assistance',
      status: 'OPEN',
      openings: 3,
      filledCount: 0,
      grossPay: 200,
      payBasis: 'hourly',
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile,
      filters: { minPay: 250 }
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('less than required minimum'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 4: Hard requirement rejection - Max pay violated
  // ==========================================
  it('4. Hard Requirement Rejection: explicit maxPay filter excludes jobs exceeding budget cap', () => {
    const job = {
      title: 'Master Chef',
      status: 'OPEN',
      openings: 1,
      filledCount: 0,
      grossPay: 1200,
      payBasis: 'hourly',
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      filters: { maxPay: 800 }
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('exceeds requested maximum'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 5: Hard requirement rejection - Distance radius exceeded
  // ==========================================
  it('5. Hard Requirement Rejection: explicit distance radius strictly excludes distant jobs', () => {
    const job = {
      title: 'Mumbai Event Usher',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760] // Mumbai coordinates (~300 km from Atigre)
      },
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      filters: {
        originLat: 16.7410,
        originLng: 74.3720,
        maxDistanceKm: 15
      }
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('exceeds explicit radius'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 6: Hard requirement rejection - Explicit date mismatch
  // ==========================================
  it('6. Hard Requirement Rejection: explicit date filter rejects shifts on different calendar dates', () => {
    const job = {
      title: 'Weekend Staff',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      workDate: '2026-11-20T00:00:00.000Z'
    };

    const res = classifyJobMatch({
      job,
      filters: { workDate: '2026-11-15' }
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('does not match requested date'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 7: Hard requirement rejection - Employer mandatory skill missing
  // ==========================================
  it('7. Hard Requirement Rejection: employer-defined mandatory skill missing excludes candidate from all tiers', () => {
    const job = {
      title: 'Certified MIG Welder',
      category: 'Other lawful temporary work',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Certified Welder', 'Structural Steel Fabrication'],
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    // Worker only has ['Server', 'Food Service']
    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('Missing employer mandatory required skill'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 8: Hard requirement rejection - Deadline passed or work ended
  // ==========================================
  it('8. Hard Requirement Rejection: expired deadline or ended shift is rejected immediately', () => {
    const pastJob = {
      title: 'Expired Shift',
      status: 'OPEN',
      openings: 1,
      filledCount: 0,
      workDate: new Date(Date.now() - 86400000).toISOString(),
      startTime: '08:00',
      endTime: '16:00',
      applicationDeadline: new Date(Date.now() - 3600000).toISOString()
    };

    const res = classifyJobMatch({
      job: pastJob,
      workerProfile: skilledWorkerProfile,
      now: new Date()
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.length).toBeGreaterThan(0);
  });

  // ==========================================
  // SCENARIO 9: Hard requirement rejection - Zero openings left
  // ==========================================
  it('9. Hard Requirement Rejection: fully filled job (0 openings left) is rejected', () => {
    const fullJob = {
      title: 'Filled Shift',
      status: 'OPEN',
      openings: 3,
      filledCount: 3,
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job: fullJob,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(false);
    expect(res.rejectionReasons.some((r) => r.includes('openings for this job are filled'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 10: Strong match with 1 missing optional skill
  // ==========================================
  it('10. Strong Match: satisfies all hard constraints but misses 1 optional skill', () => {
    const nextFriday = new Date();
    nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));

    const job = {
      title: 'Banquet Steward',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Server'], // satisfied
      optionalSkills: ['Wine Pairing Knowledge'], // missing optional
      grossPay: 350,
      payBasis: 'hourly',
      workDate: nextFriday.toISOString(),
      startTime: '18:00',
      endTime: '22:00',
      totalHours: 4,
      location: {
        type: 'Point',
        coordinates: [74.3720, 16.7410]
      },
      applicationDeadline: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(true);
    expect(res.matchType).toBe(MATCH_TYPES.STRONG);
    expect(res.missingOptionalSkills).toContain('Wine Pairing Knowledge');
    expect(res.preferenceDifferences.some((d) => d.includes('optional skill'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 11: Strong match with minor distance excess (profile preference)
  // ==========================================
  it('11. Strong Match: minor travel radius excess (18 km vs 15 km preferred) with no explicit distance filter', () => {
    const nextFriday = new Date();
    nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));

    const job = {
      title: 'Restaurant Server',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Server'],
      grossPay: 350,
      payBasis: 'hourly',
      workDate: nextFriday.toISOString(),
      startTime: '18:00',
      endTime: '22:00',
      totalHours: 4,
      location: {
        type: 'Point',
        // Coordinates ~18 km away from Atigre (Hatkanangale/Jaysingpur direction)
        coordinates: [74.5200, 16.7600]
      },
      applicationDeadline: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(true);
    expect(res.matchType).toBe(MATCH_TYPES.STRONG);
    expect(res.preferenceDifferences.some((d) => d.includes('travel radius'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 12: Strong match with related category (profile preference)
  // ==========================================
  it('12. Strong Match: closely related category (Wedding and catering support vs preferred Restaurant and hospitality)', () => {
    const nextFriday = new Date();
    nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));

    const job = {
      title: 'Wedding Reception Waiter',
      category: 'Wedding and catering support', // related to 'Restaurant and hospitality'
      status: 'OPEN',
      openings: 4,
      filledCount: 0,
      requiredSkills: ['Server'],
      grossPay: 350,
      payBasis: 'hourly',
      workDate: nextFriday.toISOString(),
      startTime: '18:00',
      endTime: '22:00',
      totalHours: 4,
      location: {
        type: 'Point',
        coordinates: [74.3720, 16.7410]
      },
      applicationDeadline: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(true);
    expect(res.matchType).toBe(MATCH_TYPES.STRONG);
    expect(res.preferenceDifferences.some((d) => d.includes('Related category'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 13: Partial match with multiple soft preference differences
  // ==========================================
  it('13. Partial Match: qualifies when all hard constraints met but differs on multiple soft preferences', () => {
    // Scheduled on Tuesday (worker prefers Friday/Saturday/Sunday)
    // Rate is ₹250/hr (worker expectedPay.min is ₹300/hr)
    const nextTuesday = new Date();
    nextTuesday.setDate(nextTuesday.getDate() + ((2 - nextTuesday.getDay() + 7) % 7 || 7));

    const job = {
      title: 'Bistro Server',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Server'],
      grossPay: 250, // below expectedPay.min (300)
      payBasis: 'hourly',
      workDate: nextTuesday.toISOString(), // outside preferred days
      startTime: '18:00',
      endTime: '22:00',
      totalHours: 4,
      location: {
        type: 'Point',
        coordinates: [74.3720, 16.7410]
      },
      applicationDeadline: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile
    });

    expect(res.eligible).toBe(true);
    expect(res.matchType).toBe(MATCH_TYPES.PARTIAL);
    expect(res.preferenceDifferences.length).toBeGreaterThanOrEqual(2);
    expect(res.preferenceDifferences.some((d) => d.includes('below your profile target'))).toBe(true);
    expect(res.preferenceDifferences.some((d) => d.includes('outside your typical available days'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 14: Partial match with pay below worker profile expectation
  // ==========================================
  it('14. Partial Match: pay below profile expectation is a soft difference when no UI pay filter set', () => {
    const job = {
      title: 'Cafe Server',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Server'],
      grossPay: 220, // below worker's expected ₹300
      payBasis: 'hourly',
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile,
      filters: {} // No explicit minPay filter
    });

    expect(res.eligible).toBe(true);
    expect(res.preferenceDifferences.some((d) => d.includes('below your profile target'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 15: Partial match with day outside worker preferred days
  // ==========================================
  it('15. Partial Match: shift on worker non-preferred day is a soft difference when no UI date filter set', () => {
    // Wednesday (worker profile only lists Fri, Sat, Sun)
    const nextWednesday = new Date();
    nextWednesday.setDate(nextWednesday.getDate() + ((3 - nextWednesday.getDay() + 7) % 7 || 7));

    const job = {
      title: 'Weekday Dinner Server',
      category: 'Restaurant and hospitality',
      status: 'OPEN',
      openings: 2,
      filledCount: 0,
      requiredSkills: ['Server'],
      grossPay: 350,
      payBasis: 'hourly',
      workDate: nextWednesday.toISOString()
    };

    const res = classifyJobMatch({
      job,
      workerProfile: skilledWorkerProfile,
      filters: {}
    });

    expect(res.eligible).toBe(true);
    expect(res.preferenceDifferences.some((d) => d.includes('outside your typical available days'))).toBe(true);
  });

  // ==========================================
  // SCENARIO 16: Invariant - Partial match NEVER violates hard requirements
  // ==========================================
  it('16. CRITICAL INVARIANT: A partial match never contains a hard requirement violation', () => {
    const invalidJob = {
      title: 'Forklift Operator',
      category: 'Warehouse and packing',
      status: 'OPEN',
      openings: 1,
      filledCount: 0,
      requiredSkills: ['Heavy Equipment'], // worker missing mandatory skill
      grossPay: 150,
      payBasis: 'hourly',
      workDate: new Date(Date.now() + 86400000).toISOString()
    };

    const res = classifyJobMatch({
      job: invalidJob,
      workerProfile: skilledWorkerProfile,
      filters: { category: 'Restaurant and hospitality', minPay: 300 }
    });

    // Must be completely ineligible, NOT a partial match
    expect(res.eligible).toBe(false);
    expect(res.matchType).toBeNull();
  });

  // ==========================================
  // SCENARIO 17: Provenance tracking
  // ==========================================
  it('17. Requirement Provenance: accurately tracks UI_FILTER, NLP_QUERY, WORKER_PROFILE, SAFETY_CONDITION', () => {
    const partitionResult = partitionMixedJobMatches([], {
      workerProfile: skilledWorkerProfile,
      filters: {
        category: 'Restaurant and hospitality',
        minPay: 300
      },
      provenanceMap: {
        category: PROVENANCE_SOURCES.UI_FILTER,
        minPay: PROVENANCE_SOURCES.NLP_QUERY
      }
    });

    const reqs = partitionResult.appliedRequirements;
    const catReq = reqs.find((r) => r.field === 'category');
    expect(catReq.source).toBe(PROVENANCE_SOURCES.UI_FILTER);
    expect(catReq.type).toBe(REQUIREMENT_TYPES.HARD);

    const payReq = reqs.find((r) => r.field === 'minPay');
    expect(payReq.source).toBe(PROVENANCE_SOURCES.NLP_QUERY);
    expect(payReq.type).toBe(REQUIREMENT_TYPES.HARD);

    const safetyReq = reqs.find((r) => r.field === 'status');
    expect(safetyReq.source).toBe(PROVENANCE_SOURCES.SAFETY_CONDITION);
    expect(safetyReq.type).toBe(REQUIREMENT_TYPES.HARD);

    const profileRadiusReq = reqs.find((r) => r.field === 'travelRadiusKm');
    expect(profileRadiusReq.source).toBe(PROVENANCE_SOURCES.WORKER_PROFILE);
    expect(profileRadiusReq.type).toBe(REQUIREMENT_TYPES.SOFT);
  });

  // ==========================================
  // SCENARIO 18: Skill matching aliases without false substring matches
  // ==========================================
  it('18. Skills Matching: supports canonical aliases and prevents substring false positives (car != carpenter, bar != bartender)', () => {
    // 1. Canonical aliases match
    expect(areSkillsMatching('server', 'waiter')).toBe(true);
    expect(areSkillsMatching('Waitress', 'Server')).toBe(true);
    expect(areSkillsMatching('cashier', 'billing')).toBe(true);
    expect(areSkillsMatching('cleaner', 'housekeeping')).toBe(true);
    expect(areSkillsMatching('order packing', 'packaging')).toBe(true);

    // 2. Substring traps DO NOT match
    expect(areSkillsMatching('car', 'carpenter')).toBe(false);
    expect(areSkillsMatching('bar', 'bartender')).toBe(false);
    expect(areSkillsMatching('pan', 'company receptionist')).toBe(false);
    expect(areSkillsMatching('act', 'tractor driver')).toBe(false);
  });

  // ==========================================
  // SCENARIO 19: Payment normalization across bases using actual totalHours
  // ==========================================
  it('19. Payment Normalization: accurately calculates shift hours from schedule without hardcoded 8h assumption', () => {
    // 4-hour evening shift paying ₹1200 per shift -> ₹300/hr
    const job4h = {
      startTime: '18:00',
      endTime: '22:00',
      totalHours: 4,
      grossPay: 1200,
      payBasis: 'shift'
    };
    expect(calculateJobHours(job4h)).toBe(4);

    const payRes = evaluatePaymentScore(
      { min: 300, basis: 'hourly' },
      job4h.grossPay,
      job4h.payBasis,
      calculateJobHours(job4h)
    );
    expect(payRes.score).toBe(1.0);

    // Overnight shift: 22:00 to 06:00 (8 hours)
    const overnightJob = {
      startTime: '22:00',
      endTime: '06:00',
      grossPay: 2400,
      payBasis: 'shift'
    };
    expect(calculateJobHours(overnightJob)).toBe(8);
  });

  // ==========================================
  // SCENARIO 20: Unknown distance presented as distanceReliability: 'unknown'
  // ==========================================
  it('20. Distance Reliability: unknown coordinates reported as distanceReliability: "unknown" without invented scores', () => {
    const uncalibratedJob = {
      title: 'Uncalibrated Location Job',
      location: {
        type: 'Point',
        coordinates: [0, 0] // uncalibrated
      }
    };

    const res = evaluateLocationScore({ coordinates: [74.3720, 16.7410] }, uncalibratedJob.location, 25);
    expect(res.distanceKm).toBeNull();
    expect(res.distanceReliability).toBe('unknown');
    expect(res.explanation).toContain('Distance unknown');
  });

  // ==========================================
  // SCENARIO 21: "Show close matches" parameter toggles strong and partial results
  // ==========================================
  it('21. Show Close Matches Toggle: when disabled, strong and partial matches are empty and counts reflect exact only', () => {
    const jobs = [
      {
        _id: 'job_exact',
        title: 'Exact Banquet Server',
        category: 'Restaurant and hospitality',
        status: 'OPEN',
        openings: 5,
        filledCount: 0,
        requiredSkills: ['Server'],
        grossPay: 350,
        payBasis: 'hourly',
        workDate: '2026-11-20T00:00:00.000Z',
        startTime: '18:00',
        endTime: '22:00',
        location: { type: 'Point', coordinates: [74.3720, 16.7410] },
        applicationDeadline: new Date(Date.now() + 86400000).toISOString()
      },
      {
        _id: 'job_strong',
        title: 'Wedding Reception Waiter',
        category: 'Wedding and catering support', // related
        status: 'OPEN',
        openings: 5,
        filledCount: 0,
        requiredSkills: ['Server'],
        grossPay: 350,
        payBasis: 'hourly',
        workDate: '2026-11-20T00:00:00.000Z',
        startTime: '18:00',
        endTime: '22:00',
        location: { type: 'Point', coordinates: [74.3720, 16.7410] },
        applicationDeadline: new Date(Date.now() + 86400000).toISOString()
      }
    ];

    // Toggle ON: both exact and strong returned
    const withClose = partitionMixedJobMatches(jobs, {
      workerProfile: skilledWorkerProfile,
      showCloseMatches: true
    });
    expect(withClose.results.exact.length).toBe(1);
    expect(withClose.results.strong.length).toBe(1);
    expect(withClose.counts.total).toBe(2);

    // Toggle OFF: only exact returned
    const withoutClose = partitionMixedJobMatches(jobs, {
      workerProfile: skilledWorkerProfile,
      showCloseMatches: false
    });
    expect(withoutClose.results.exact.length).toBe(1);
    expect(withoutClose.results.strong).toHaveLength(0);
    expect(withoutClose.results.partial).toHaveLength(0);
    expect(withoutClose.counts.strong).toBe(0);
    expect(withoutClose.counts.partial).toBe(0);
    expect(withoutClose.counts.total).toBe(1);
  });

  // ==========================================
  // SCENARIO 22: Natural Language search parser
  // ==========================================
  it('22. Natural Language Parser: parses complex multi-dimensional query into structured requirements', async () => {
    const complexQuery = 'Find evening data entry jobs in Vijayawada within 10 km, paying ₹500 to ₹800 per day this weekend.';
    const parsed = await aiExplanationService.parseNaturalLanguageSearch(complexQuery);

    expect(parsed.shiftTiming).toBe('evening');
    expect(parsed.category).toBe('Data entry and office assistance');
    expect(parsed.requiredSkills).toContain('data entry');
    expect(parsed.city).toBe('Vijayawada');
    expect(parsed.locality).toBe('Vijayawada');
    expect(parsed.maxDistanceKm).toBe(10);
    expect(parsed.minPay).toBe(500);
    expect(parsed.maxPay).toBe(800);
    expect(parsed.payBasis).toBe('daily');
    expect(parsed.dateFilter).toBe('weekend');
    expect(parsed.workDate).toBeDefined();
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ==========================================
  // SCENARIO 23: Backward compatibility of API endpoints
  // ==========================================
  it('23. Backward Compatibility: GET /api/jobs and /api/recommendations/jobs return results and legacy arrays', async () => {
    // 1. GET /api/jobs
    const jobsRes = await request(app).get('/api/jobs');
    expect(jobsRes.status).toBe(200);
    expect(jobsRes.body.success).toBe(true);
    expect(Array.isArray(jobsRes.body.jobs)).toBe(true);
    expect(jobsRes.body.results).toBeDefined();
    expect(jobsRes.body.counts).toBeDefined();
    expect(jobsRes.body.appliedRequirements).toBeDefined();

    // 2. GET /api/recommendations/jobs
    const recRes = await request(app)
      .get('/api/recommendations/jobs')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(recRes.status).toBe(200);
    expect(recRes.body.success).toBe(true);
    expect(Array.isArray(recRes.body.recommendations)).toBe(true);
    expect(recRes.body.results).toBeDefined();
    expect(recRes.body.counts).toBeDefined();
  });

  // ==========================================
  // SCENARIO 24: Bounded candidate scoring in controllers
  // ==========================================
  it('24. Bounded Candidate Scoring: jobs and recommendations controllers apply limit bounds', async () => {
    const recRes = await request(app)
      .get('/api/recommendations/jobs?limit=5')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations.length).toBeLessThanOrEqual(5);
  });
});
