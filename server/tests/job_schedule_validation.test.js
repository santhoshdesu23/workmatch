import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { Job } from '../src/models/Job.js';
import { ROLES, APPLICATION_STATUSES } from '../src/config/constants.js';
import { signToken } from '../src/config/jwt.js';
import { validateJobSchedule, formatCalendarDate } from '../src/utils/scheduleUtils.js';

describe('WorkMatch Job Scheduling Validation (Unit & Direct API Tests)', () => {
  let mongoServer;
  let employerToken;
  let employerId;
  let workerToken;
  let workerId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const employer = await User.create({
      name: 'Schedule Test Employer',
      firstName: 'Schedule',
      lastName: 'Employer',
      email: 'schedule.employer@example.com',
      passwordHash: 'hashed_password_123',
      role: ROLES.EMPLOYER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    employerId = employer._id;
    employerToken = signToken({ id: employer._id, role: employer.role });

    await EmployerProfile.create({
      user: employer._id,
      businessName: 'Schedule Test Hospitality Group',
      verificationStatus: 'verified'
    });

    const worker = await User.create({
      name: 'Schedule Test Worker',
      firstName: 'Schedule',
      lastName: 'Worker',
      email: 'schedule.worker@example.com',
      passwordHash: 'hashed_password_123',
      role: ROLES.WORKER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    workerId = worker._id;
    workerToken = signToken({ id: worker._id, role: worker.role });

    await WorkerProfile.create({
      user: worker._id,
      skills: ['Event Support', 'Hospitality'],
      preferredCategories: ['Event assistance'],
      location: { type: 'Point', coordinates: [74.375, 16.742] }
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // =========================================================================
  // 1. UNIT TESTS FOR SCHEDULE VALIDATION RULES
  // =========================================================================
  describe('Unit Validation Rules (validateJobSchedule)', () => {
    const fixedNow = new Date(2026, 9, 28, 14, 30, 0, 0); // 2026-10-28 14:30 local

    it('Rule 1a: Rejects past work dates', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-27',
        startTime: '09:00',
        endTime: '17:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.workDate).toMatch(/past/i);
    });

    it("Rule 1b: Rejects past start time when today's date is selected", () => {
      const res = validateJobSchedule({
        workDate: '2026-10-28',
        startTime: '12:00',
        endTime: '18:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.startTime).toMatch(/past/i);
    });

    it('Rule 1c: Rejects a start time equal to the current time', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-28',
        startTime: '14:30',
        endTime: '18:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.startTime).toMatch(/future|current time/i);
    });

    it('Rule 1d: Accepts valid future start time on today and future dates', () => {
      const todayFuture = validateJobSchedule({
        workDate: '2026-10-28',
        startTime: '14:31',
        endTime: '18:00',
        now: fixedNow
      });
      expect(todayFuture.isValid).toBe(true);
      expect(todayFuture.error).toBeNull();

      const futureDay = validateJobSchedule({
        workDate: '2026-10-30',
        startTime: '08:00',
        endTime: '16:00',
        now: fixedNow
      });
      expect(futureDay.isValid).toBe(true);
      expect(futureDay.durationHours).toBe(8);
    });

    it('Rule 2a: Rejects an end time earlier than the start time on the same date', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-30',
        startTime: '15:00',
        endTime: '11:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.endTime).toMatch(/after/i);
    });

    it('Rule 2b: Rejects an end time equal to the start time', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-30',
        startTime: '15:00',
        endTime: '15:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.endTime).toMatch(/equal|after/i);
    });

    it('Rule 2c: Allows work that continues into the next day when end date is later than start date', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-30',
        workEndDate: '2026-10-31',
        startTime: '22:00',
        endTime: '06:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(true);
      expect(res.isOvernight).toBe(true);
      expect(res.durationHours).toBe(8);
    });

    it('Rule 2d: Rejects an end date earlier than the start date', () => {
      const res = validateJobSchedule({
        workDate: '2026-10-30',
        workEndDate: '2026-10-29',
        startTime: '09:00',
        endTime: '17:00',
        now: fixedNow
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.workEndDate).toMatch(/earlier/i);
    });
  });

  // =========================================================================
  // 2. DIRECT API VALIDATION TESTS (POST /api/jobs & PATCH /api/jobs/:jobId)
  // =========================================================================
  describe('Direct API Request Enforcement (HTTP 400 on Invalid Schedules)', () => {
    const baseJobPayload = {
      title: 'Evening Banquet Coordinator',
      description: 'Coordinate table service and guest seating for reception event.',
      category: 'Event assistance',
      requiredSkills: ['Event Support'],
      openings: 2,
      locationName: 'Royal Palace Hall, Kolhapur',
      coordinates: [74.375, 16.742],
      totalHours: 4,
      grossPay: 600,
      payBasis: 'shift'
    };

    it('Rejects direct API job creation with a past start date (HTTP 400)', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatCalendarDate(yesterday);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: yesterdayStr,
          startTime: '09:00',
          endTime: '13:00'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/past/i);
    });

    it('Rejects direct API job creation with a start time equal to current time on today (HTTP 400)', async () => {
      const now = new Date();
      const todayStr = formatCalendarDate(now);
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHH}:${currentMM}`;

      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = formatCalendarDate(nextDay);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: todayStr,
          workEndDate: nextDayStr,
          startTime: currentTimeStr,
          endTime: '18:00'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/future|current time|past/i);
    });

    it('Rejects direct API job creation with a past start time on today (HTTP 400)', async () => {
      const now = new Date();
      // Pick a time 5 minutes ago; if within first 5 minutes of the day, the date itself becomes yesterday
      const pastInstant = new Date(now.getTime() - 5 * 60 * 1000);
      const dateStr = formatCalendarDate(pastInstant);
      const pastHH = String(pastInstant.getHours()).padStart(2, '0');
      const pastMM = String(pastInstant.getMinutes()).padStart(2, '0');
      const pastTimeStr = `${pastHH}:${pastMM}`;

      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: dateStr,
          workEndDate: formatCalendarDate(nextDay),
          startTime: pastTimeStr,
          endTime: '23:59'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/past|future/i);
    });

    it('Rejects direct API job creation when end time is before start time on the same date (HTTP 400)', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const futureStr = formatCalendarDate(future);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: futureStr,
          workEndDate: futureStr,
          startTime: '16:00',
          endTime: '10:00'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/after/i);
    });

    it('Rejects direct API job creation when end time equals start time (HTTP 400)', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const futureStr = formatCalendarDate(future);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: futureStr,
          workEndDate: futureStr,
          startTime: '14:00',
          endTime: '14:00'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/equal|after/i);
    });

    it('Accepts future start time with same-day later end time (HTTP 201)', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 4);
      const futureStr = formatCalendarDate(future);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          workDate: futureStr,
          workEndDate: futureStr,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.startTime).toBe('09:00');
      expect(res.body.job.endTime).toBe('17:00');
    });

    it('Accepts overnight shift where end time is on the following day (HTTP 201) and preserves application, assignment & TrustTrack flows', async () => {
      const startDay = new Date();
      startDay.setDate(startDay.getDate() + 5);
      const endDay = new Date(startDay);
      endDay.setDate(endDay.getDate() + 1);

      const startDayStr = formatCalendarDate(startDay);
      const endDayStr = formatCalendarDate(endDay);

      // 1. Create overnight shift (22:00 on startDay -> 06:00 on endDay)
      const createRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          ...baseJobPayload,
          title: 'Overnight Event Security & Breakdown',
          workDate: startDayStr,
          workEndDate: endDayStr,
          startTime: '22:00',
          endTime: '06:00',
          totalHours: 8
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const jobId = createRes.body.job._id;

      // 2. Reject invalid schedule update via PATCH /api/jobs/:jobId (HTTP 400)
      const invalidPatchRes = await request(app)
        .patch(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          workDate: startDayStr,
          workEndDate: startDayStr,
          startTime: '18:00',
          endTime: '12:00'
        });
      expect(invalidPatchRes.status).toBe(400);
      expect(invalidPatchRes.body.success).toBe(false);

      // 3. Worker applies to the valid overnight shift
      const applyRes = await request(app)
        .post(`/api/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Available for overnight shift' });
      expect(applyRes.status).toBe(201);
      const applicationId = applyRes.body.application._id;

      // 4. Valid schedule update records TrustTrack history and notifies applicant
      const validPatchRes = await request(app)
        .patch(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          endTime: '06:30',
          reason: 'Extended breakdown window by 30 minutes'
        });
      expect(validPatchRes.status).toBe(200);
      expect(validPatchRes.body.changesRecorded).toBeGreaterThanOrEqual(1);

      // 5. Employer hires worker -> assignment created without error
      const hireRes = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: APPLICATION_STATUSES.HIRED });
      expect(hireRes.status).toBe(200);
      expect(hireRes.body.success).toBe(true);

      const jobInDb = await Job.findById(jobId);
      expect(jobInDb.filledCount).toBe(1);
    });
  });
});

