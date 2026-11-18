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
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES } from '../src/config/constants.js';
import { signToken } from '../src/config/jwt.js';
import { formatCalendarDate } from '../src/utils/scheduleUtils.js';

describe('Newly Posted Jobs Browse & Worker Discovery Workflow', () => {
  let mongoServer;
  let employerToken;
  let employerId;
  let workerToken;
  let workerId;

  const getFutureDateStr = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return formatCalendarDate(d);
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create verified employer
    const employer = await User.create({
      name: 'Global Events Ltd',
      firstName: 'Global',
      lastName: 'Events',
      email: 'employer.global@example.com',
      passwordHash: 'hashed_pw_emp',
      role: ROLES.EMPLOYER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    employerId = employer._id;
    employerToken = signToken({ id: employer._id, role: employer.role });

    await EmployerProfile.create({
      user: employerId,
      businessName: 'Global Events Ltd',
      verificationStatus: 'verified'
    });

    // Create verified worker with specific skills
    const worker = await User.create({
      name: 'Sunil Kumar',
      firstName: 'Sunil',
      lastName: 'Kumar',
      email: 'sunil.worker@example.com',
      passwordHash: 'hashed_pw_worker',
      role: ROLES.WORKER,
      emailVerified: true,
      verificationStatus: 'verified'
    });
    workerId = worker._id;
    workerToken = signToken({ id: worker._id, role: worker.role });

    await WorkerProfile.create({
      user: workerId,
      skills: ['Bartending', 'Cocktail Mixing'], // Sunil is a bartender
      travelRadiusKm: 50,
      expectedPay: { min: 200, max: 1000, basis: 'hourly' }
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  let createdJobId;
  const workDateStr = getFutureDateStr(4);

  it('TEST 1: Employer creates and successfully publishes a new job with non-matching worker skills', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Urgent Warehouse Forklift Operator',
        description: 'Operate standard warehouse forklifts and pallet jacks for palletized inventory.',
        category: 'Warehouse and packing',
        requiredSkills: ['Forklift Certified', 'Heavy Pallet Jack'],
        openings: 3,
        locationName: 'Indiranagar, Bangalore, Karnataka',
        coordinates: [77.6412, 12.9784],
        workDate: workDateStr,
        workEndDate: workDateStr,
        startTime: '08:00',
        endTime: '16:00',
        breakDurationMinutes: 60,
        totalHours: 7,
        grossPay: 550,
        payBasis: 'hourly',
        paymentMethod: 'Direct Bank Transfer',
        paymentTiming: 'Same Day Payment',
        experienceRequirement: '2+ years forklift experience',
        applicationDeadline: workDateStr,
        detailsConfirmed: true,
        status: 'OPEN'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.status).toBe('OPEN');
    expect(res.body.job.locality).toBe('Indiranagar');
    expect(res.body.job.city).toBe('Bangalore');

    createdJobId = res.body.job._id;
  });

  it('TEST 2: Worker opens Browse Jobs and the newly published job appears in jobs list', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.jobs)).toBe(true);

    const found = res.body.jobs.find((j) => String(j._id) === String(createdJobId));
    expect(found).toBeDefined();
    expect(found.title).toBe('Urgent Warehouse Forklift Operator');
    expect(found.grossPay).toBe(550);
  });

  it('TEST 3: Worker refreshes Browse Jobs and job remains visible', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(createdJobId));
    expect(found).toBeDefined();
  });

  it('TEST 4: Worker searches for the newly published job by keyword', async () => {
    const res = await request(app)
      .get('/api/jobs?search=Forklift')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(createdJobId));
    expect(found).toBeDefined();
    expect(found.title).toContain('Forklift');
  });

  it('TEST 5: Worker filters by location and category', async () => {
    const res = await request(app)
      .get(`/api/jobs?locality=Indiranagar&category=${encodeURIComponent('Warehouse and packing')}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(createdJobId));
    expect(found).toBeDefined();
  });

  it('TEST 6: Employer saves a draft; draft does not appear in Browse Jobs', async () => {
    const draftJob = await Job.create({
      employer: employerId,
      title: 'Unpublished Draft Shift',
      description: 'This is an internal draft shift not yet finalized.',
      category: 'Event assistance',
      locationName: 'Indiranagar, Bangalore',
      workDate: new Date(workDateStr),
      startTime: '10:00',
      endTime: '18:00',
      totalHours: 8,
      grossPay: 400,
      openings: 2,
      status: JOB_STATUSES.DRAFT
    });

    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(draftJob._id));
    expect(found).toBeUndefined();
  });

  it('TEST 7: Employer suspends a job; suspended job is hidden from Browse Jobs', async () => {
    const suspendedJob = await Job.create({
      employer: employerId,
      title: 'Suspended Security Shift',
      description: 'This shift is suspended due to employer schedule revision.',
      category: 'Event assistance',
      locationName: 'Indiranagar, Bangalore',
      workDate: new Date(workDateStr),
      startTime: '10:00',
      endTime: '18:00',
      totalHours: 8,
      grossPay: 400,
      openings: 1,
      status: JOB_STATUSES.SUSPENDED
    });

    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(suspendedJob._id));
    expect(found).toBeUndefined();
  });

  it('TEST 8: Expired job is not displayed in Browse Jobs', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const expiredJob = await Job.create({
      employer: employerId,
      title: 'Past Expired Shift',
      description: 'Past shift where work has ended.',
      category: 'Event assistance',
      locationName: 'Indiranagar, Bangalore',
      workDate: pastDate,
      startTime: '09:00',
      endTime: '17:00',
      totalHours: 8,
      grossPay: 400,
      openings: 1,
      status: JOB_STATUSES.OPEN
    });

    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(expiredJob._id));
    expect(found).toBeUndefined();
  });

  it('TEST 9: Previously published jobs continue appearing correctly', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.jobs.find((j) => String(j._id) === String(createdJobId));
    expect(found).toBeDefined();
  });

  it('TEST 10: Worker applies for the newly published job', async () => {
    const res = await request(app)
      .post(`/api/jobs/${createdJobId}/apply`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        coverLetter: 'I am available and ready to operate warehouse forklifts.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.application).toBeDefined();
    expect(res.body.application.status).toBe(APPLICATION_STATUSES.APPLIED);

    // Verify application in DB
    const appInDb = await Application.findOne({ job: createdJobId, worker: workerId });
    expect(appInDb).toBeDefined();
    expect(appInDb.status).toBe(APPLICATION_STATUSES.APPLIED);
  });
});
