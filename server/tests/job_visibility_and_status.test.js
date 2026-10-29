import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES } from '../src/config/constants.js';
import { signToken } from '../src/config/jwt.js';
import {
  formatCalendarDate,
  isJobApplicationDeadlinePassed,
  isJobWorkEnded,
  isJobWorkOngoing,
  isJobOpenForApplications,
  getEffectiveJobStatus,
  getJobShiftEndDateTime
} from '../src/utils/scheduleUtils.js';

describe('WorkMatch Job Visibility, Deadline & Work-End Status Handling', () => {
  let mongoServer;
  let employerToken;
  let employerId;
  let workerToken;
  let workerId;

  // Helper date generators relative to today
  const getOffsetDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return formatCalendarDate(d);
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create verified employer
    const employer = await User.create({
      name: 'Acme Operations Corp',
      firstName: 'Acme',
      lastName: 'Operations',
      email: 'acme.ops@example.com',
      passwordHash: 'hashed_pw_acme',
      role: ROLES.EMPLOYER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    employerId = employer._id;
    employerToken = signToken({ id: employer._id, role: employer.role });

    await EmployerProfile.create({
      user: employerId,
      businessName: 'Acme Operations Corp',
      verificationStatus: 'verified'
    });

    // Create verified worker
    const worker = await User.create({
      name: 'Rohan Sharma',
      firstName: 'Rohan',
      lastName: 'Sharma',
      email: 'rohan.worker@example.com',
      passwordHash: 'hashed_pw_rohan',
      role: ROLES.WORKER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    workerId = worker._id;
    workerToken = signToken({ id: worker._id, role: worker.role });

    await WorkerProfile.create({
      user: workerId,
      skills: ['Inventory Staging', 'Warehouse Logistics'],
      travelRadiusKm: 30,
      availability: { isAvailable: true, days: ['Monday', 'Tuesday', 'Wednesday'], timeSlots: ['Morning', 'Evening'] },
      expectedPay: { min: 200, max: 500, basis: 'hourly' }
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Open jobs with future application deadlines', () => {
    it('returns open jobs with future deadlines in GET /api/jobs discovery', async () => {
      const futureDate = getOffsetDate(5);
      const futureDeadline = new Date();
      futureDeadline.setDate(futureDeadline.getDate() + 4);

      const job = await Job.create({
        employer: employerId,
        title: 'Future Warehouse Staging Shift',
        description: 'Handling incoming inventory before peak season.',
        category: 'Logistics',
        requiredSkills: ['Warehouse Logistics'],
        workDate: new Date(`${futureDate}T00:00:00.000Z`),
        workEndDate: new Date(`${futureDate}T00:00:00.000Z`),
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 350,
        payBasis: 'hourly',
        openings: 2,
        filledCount: 0,
        applicationDeadline: futureDeadline,
        locationName: 'Atigre Logistics Park, Kolhapur',
        status: JOB_STATUSES.OPEN
      });

      const res = await request(app)
        .get('/api/jobs')
        .query({ search: 'Future Warehouse Staging' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const matched = res.body.jobs.find((j) => j._id.toString() === job._id.toString());
      expect(matched).toBeDefined();
      expect(matched.isDeadlinePassed).toBe(false);
      expect(matched.isWorkEnded).toBe(false);
      expect(matched.effectiveStatus).toBe('OPEN');
    });

    it('recommends open jobs with future deadlines via GET /api/recommendations/jobs', async () => {
      const res = await request(app)
        .get('/api/recommendations/jobs')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
      const hasJob = res.body.recommendations.some((r) => r.title.includes('Future Warehouse Staging'));
      expect(hasJob).toBe(true);
    });

    it('allows verified worker to apply before the application deadline', async () => {
      const job = await Job.findOne({ title: 'Future Warehouse Staging Shift' });
      const res = await request(app)
        .post(`/api/jobs/${job._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'I have warehouse logistics experience.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application).toBeDefined();
    });
  });

  describe('2. Jobs whose application deadlines have passed', () => {
    let expiredDeadlineJob;

    beforeAll(async () => {
      const futureDate = getOffsetDate(4);
      // Deadline was yesterday, but shift is in 4 days
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1);

      expiredDeadlineJob = await Job.create({
        employer: employerId,
        title: 'Closed Applications Future Shift',
        description: 'Shift where applications closed yesterday.',
        category: 'Hospitality',
        requiredSkills: ['Event Support'],
        workDate: new Date(`${futureDate}T00:00:00.000Z`),
        workEndDate: new Date(`${futureDate}T00:00:00.000Z`),
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        grossPay: 400,
        payBasis: 'hourly',
        openings: 3,
        filledCount: 0,
        applicationDeadline: pastDeadline,
        locationName: 'Shiroli Convention Center',
        status: JOB_STATUSES.OPEN
      });
    });

    it('excludes job from available discovery jobs (GET /api/jobs)', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .query({ search: 'Closed Applications Future Shift' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const matched = res.body.jobs.find((j) => j._id.toString() === expiredDeadlineJob._id.toString());
      expect(matched).toBeUndefined();
    });

    it('excludes job from recommendations (GET /api/recommendations/jobs)', async () => {
      const res = await request(app)
        .get('/api/recommendations/jobs')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      const matched = res.body.recommendations.find((j) => j._id.toString() === expiredDeadlineJob._id.toString());
      expect(matched).toBeUndefined();
    });

    it('rejects new worker applications with HTTP 400 when deadline expired', async () => {
      const res = await request(app)
        .post(`/api/jobs/${expiredDeadlineJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying after deadline.' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/application deadline for this job has expired/i);
    });

    it('returns effectiveStatus "APPLICATIONS_CLOSED" on GET /api/jobs/:id', async () => {
      const res = await request(app)
        .get(`/api/jobs/${expiredDeadlineJob._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.isDeadlinePassed).toBe(true);
      expect(res.body.job.isWorkEnded).toBe(false);
      expect(res.body.job.effectiveStatus).toBe('APPLICATIONS_CLOSED');
    });
  });

  describe('3. Jobs whose scheduled work end time has passed', () => {
    let pastWorkJob;

    beforeAll(async () => {
      const pastDate = getOffsetDate(-3);
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 4);

      pastWorkJob = await Job.create({
        employer: employerId,
        title: 'Past Concluded Shift',
        description: 'Shift that finished 3 days ago.',
        category: 'Cleaning',
        requiredSkills: ['Cleaning'],
        workDate: new Date(`${pastDate}T00:00:00.000Z`),
        workEndDate: new Date(`${pastDate}T00:00:00.000Z`),
        startTime: '08:00',
        endTime: '16:00',
        totalHours: 8,
        grossPay: 300,
        payBasis: 'hourly',
        openings: 1,
        filledCount: 0,
        applicationDeadline: pastDeadline,
        locationName: 'Ichalkaranji Industrial Complex',
        status: JOB_STATUSES.OPEN
      });
    });

    it('excludes past work job from open discovery (GET /api/jobs)', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .query({ search: 'Past Concluded Shift' });

      expect(res.status).toBe(200);
      const matched = res.body.jobs.find((j) => j._id.toString() === pastWorkJob._id.toString());
      expect(matched).toBeUndefined();
    });

    it('rejects applications with HTTP 400 when work has ended', async () => {
      const res = await request(app)
        .post(`/api/jobs/${pastWorkJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'Applying to a past job.' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns effectiveStatus "WORK_ENDED" on GET /api/jobs/:id', async () => {
      const res = await request(app).get(`/api/jobs/${pastWorkJob._id}`);
      expect(res.status).toBe(200);
      expect(res.body.job.isWorkEnded).toBe(true);
      expect(res.body.job.effectiveStatus).toBe('WORK_ENDED');
    });
  });

  describe('4. Ongoing and overnight shifts', () => {
    it('correctly calculates overnight shift end time into the following day', () => {
      const testJob = {
        workDate: '2026-11-01',
        workEndDate: '2026-11-01',
        startTime: '22:00',
        endTime: '06:00'
      };
      const endDateTime = getJobShiftEndDateTime(testJob);
      expect(endDateTime).toBeDefined();
      expect(endDateTime.getDate()).toBe(2);
      expect(endDateTime.getHours()).toBe(6);
      expect(endDateTime.getMinutes()).toBe(0);
    });

    it('identifies an ongoing shift when reference time falls within shift window', () => {
      const testJob = {
        workDate: '2026-11-01',
        workEndDate: '2026-11-01',
        startTime: '09:00',
        endTime: '17:00'
      };
      const midShiftTime = new Date(2026, 10, 1, 13, 30, 0);
      expect(isJobWorkOngoing(testJob, midShiftTime)).toBe(true);
      expect(isJobWorkEnded(testJob, midShiftTime)).toBe(false);
      expect(getEffectiveJobStatus(testJob, midShiftTime)).toBe('IN_PROGRESS');
    });

    it('identifies work has ended once reference time exceeds shift end time', () => {
      const testJob = {
        workDate: '2026-11-01',
        workEndDate: '2026-11-01',
        startTime: '09:00',
        endTime: '17:00'
      };
      const postShiftTime = new Date(2026, 10, 1, 17, 0, 1);
      expect(isJobWorkOngoing(testJob, postShiftTime)).toBe(false);
      expect(isJobWorkEnded(testJob, postShiftTime)).toBe(true);
      expect(getEffectiveJobStatus(testJob, postShiftTime)).toBe('WORK_ENDED');
    });
  });

  describe('5. Existing assignments remain accessible and are NOT auto-marked completed by time alone', () => {
    let pastAssignment;
    let pastJob;

    beforeAll(async () => {
      const pastDate = getOffsetDate(-2);
      pastJob = await Job.create({
        employer: employerId,
        title: 'Assigned Concluded Event Support',
        description: 'Event support completed 2 days ago.',
        category: 'Event Staff',
        requiredSkills: ['Event Support'],
        workDate: new Date(`${pastDate}T00:00:00.000Z`),
        workEndDate: new Date(`${pastDate}T00:00:00.000Z`),
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        grossPay: 500,
        payBasis: 'shift',
        openings: 1,
        filledCount: 1,
        applicationDeadline: new Date(`${pastDate}T08:00:00.000Z`),
        locationName: 'Atigre Heritage Banquet Hall',
        status: JOB_STATUSES.FILLED
      });

      const appDoc = await Application.create({
        job: pastJob._id,
        worker: workerId,
        employer: employerId,
        status: APPLICATION_STATUSES.HIRED
      });

      pastAssignment = await Assignment.create({
        job: pastJob._id,
        application: appDoc._id,
        worker: workerId,
        employer: employerId,
        agreedSchedule: {
          workDate: new Date(`${pastDate}T00:00:00.000Z`),
          workEndDate: new Date(`${pastDate}T00:00:00.000Z`),
          startTime: '10:00',
          endTime: '18:00',
          totalHours: 8
        },
        agreedPayment: {
          grossAmount: 500,
          basis: 'shift'
        },
        status: ASSIGNMENT_STATUSES.CONFIRMED // Intentionally left CONFIRMED to verify no auto-completion
      });

      await PaymentRecord.create({
        assignment: pastAssignment._id,
        job: pastJob._id,
        employer: employerId,
        worker: workerId,
        amount: 500,
        grossAmount: 500,
        netAmount: 500,
        status: PAYMENT_STATUSES.DUE
      });
    });

    it('preserves assignment status as CONFIRMED even after work end date has passed', async () => {
      const dbRecord = await Assignment.findById(pastAssignment._id);
      expect(dbRecord.status).toBe(ASSIGNMENT_STATUSES.CONFIRMED);
      expect(dbRecord.status).not.toBe(ASSIGNMENT_STATUSES.COMPLETED);
    });

    it('returns past assignment with isWorkEnded true in GET /api/assignments/me', async () => {
      const res = await request(app)
        .get('/api/assignments/me')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.assignments.find((a) => a._id.toString() === pastAssignment._id.toString());
      expect(found).toBeDefined();
      expect(found.status).toBe(ASSIGNMENT_STATUSES.CONFIRMED);
      expect(found.isWorkEnded).toBe(true);
    });

    it('requires formal confirmation workflow (/confirm-completion) to become COMPLETED', async () => {
      // Step 1: Worker confirms completion
      const workerRes = await request(app)
        .post(`/api/assignments/${pastAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(workerRes.status).toBe(200);
      expect(workerRes.body.assignment.completionConfirmations.workerConfirmed).toBe(true);
      // Status remains not COMPLETED until employer also confirms
      expect(workerRes.body.assignment.status).toBe(ASSIGNMENT_STATUSES.CONFIRMED);
      expect(workerRes.body.assignment.status).not.toBe(ASSIGNMENT_STATUSES.COMPLETED);

      // Step 2: Employer confirms completion
      const empRes = await request(app)
        .post(`/api/assignments/${pastAssignment._id}/confirm-completion`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(empRes.status).toBe(200);
      expect(empRes.body.assignment.status).toBe(ASSIGNMENT_STATUSES.COMPLETED);
    });
  });

  describe('6. Employer and Worker Dashboard Filtering', () => {
    it('employer dashboard distinguishes open jobs, closed applications, ongoing work, and past work', async () => {
      const res = await request(app)
        .get('/api/employers/me/dashboard')
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toBeDefined();
      expect(typeof res.body.metrics.openJobsCount).toBe('number');
      expect(typeof res.body.metrics.closedApplicationsCount).toBe('number');
      expect(typeof res.body.metrics.pastJobsCount).toBe('number');
      expect(typeof res.body.metrics.activeJobsCount).toBe('number');
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it('worker saved jobs endpoint attaches accurate deadline and work-end flags', async () => {
      const futureDate = getOffsetDate(3);
      const savedJob = await Job.create({
        employer: employerId,
        title: 'Saved Future Delivery Shift',
        description: 'Delivery shift saved by worker.',
        category: 'Delivery',
        requiredSkills: ['Delivery'],
        workDate: new Date(`${futureDate}T00:00:00.000Z`),
        startTime: '11:00',
        endTime: '19:00',
        totalHours: 8,
        grossPay: 350,
        payBasis: 'hourly',
        openings: 1,
        applicationDeadline: new Date(`${futureDate}T11:00:00.000Z`),
        locationName: 'Kolhapur Central Depot',
        status: JOB_STATUSES.OPEN
      });

      await WorkerProfile.findOneAndUpdate(
        { user: workerId },
        { $addToSet: { savedJobs: savedJob._id } }
      );

      const res = await request(app)
        .get('/api/workers/me/saved-jobs')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const matched = res.body.savedJobs.find((j) => j._id.toString() === savedJob._id.toString());
      expect(matched).toBeDefined();
      expect(matched.isDeadlinePassed).toBe(false);
      expect(matched.isWorkEnded).toBe(false);
      expect(matched.effectiveStatus).toBe('OPEN');
    });
  });

  describe('7. Timezone Boundaries & Legacy Deadline Handling', () => {
    it('legacy job without applicationDeadline defaults safely to shift start date-time', () => {
      const legacyJob = {
        workDate: '2026-11-10T00:00:00.000Z',
        startTime: '10:00',
        endTime: '18:00'
        // No applicationDeadline field
      };

      const beforeShift = new Date('2026-11-10T09:30:00');
      const afterShiftStart = new Date('2026-11-10T10:05:00');

      expect(isJobApplicationDeadlinePassed(legacyJob, beforeShift)).toBe(false);
      expect(isJobApplicationDeadlinePassed(legacyJob, afterShiftStart)).toBe(true);
    });

    it('UTC midnight applicationDeadline on shift day does not prematurely expire at 00:00', () => {
      const jobWithMidnightDeadline = {
        workDate: '2026-11-10T00:00:00.000Z',
        applicationDeadline: '2026-11-10T00:00:00.000Z',
        startTime: '14:00',
        endTime: '20:00',
        status: 'OPEN'
      };

      const morningOfShift = new Date('2026-11-10T08:00:00');
      // Should still be open in the morning since shift is at 14:00
      expect(isJobApplicationDeadlinePassed(jobWithMidnightDeadline, morningOfShift)).toBe(false);
      expect(isJobOpenForApplications(jobWithMidnightDeadline, morningOfShift)).toBe(true);
    });
  });
});
