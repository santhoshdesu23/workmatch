import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { signToken } from '../src/config/jwt.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Attendance } from '../src/models/Attendance.js';
import {
  ROLES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS
} from '../src/config/constants.js';

const TEST_PASSWORD = 'AttendanceTest123!';
let replicaSet;
let originalMongoUri;

// Venue reference coordinates: Sanjay Ghodawat Institute, Atigre, Kolhapur
const VENUE_LAT = 16.7410;
const VENUE_LNG = 74.3720;

async function createUser(role, suffix = `${Date.now()}-${Math.random()}`) {
  const user = await User.create({
    name: `${role} User ${suffix}`,
    firstName: role,
    lastName: 'Tester',
    email: `${role}.${suffix}@test.local`,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 8),
    role,
    roles: [role],
    activeRole: role,
    emailVerified: true
  });
  const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });
  return { user, token };
}

async function createJobWithConfirmedGPS(employerId, overrides = {}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Job.create({
    employer: employerId,
    title: 'Grand Hall Wedding Banquet Assistant',
    description: 'Assist with guest registration, greeting, and banquet support.',
    category: 'Event assistance',
    openings: 3,
    filledCount: 0,
    locationName: 'Sanjay Ghodawat Institute, Atigre, Kolhapur',
    location: {
      type: 'Point',
      coordinates: [VENUE_LNG, VENUE_LAT] // [lng, lat]
    },
    attendanceRadiusMeters: 200,
    coordinatesConfirmed: true,
    workDate: tomorrow,
    workEndDate: tomorrow,
    startTime: '09:00',
    endTime: '17:00',
    totalHours: 8,
    grossPay: 800,
    payBasis: 'shift',
    currency: 'INR',
    status: JOB_STATUSES.OPEN,
    applicationDeadline: tomorrow,
    ...overrides
  });
}

async function createHiredWorker(job, employer, suffix = `${Date.now()}-${Math.random()}`) {
  const { user: worker, token: workerToken } = await createUser(ROLES.WORKER, suffix);

  const application = await Application.create({
    job: job._id,
    worker: worker._id,
    employer: employer._id,
    status: APPLICATION_STATUSES.HIRED
  });

  const assignment = await Assignment.create({
    job: job._id,
    worker: worker._id,
    employer: employer._id,
    application: application._id,
    agreedSchedule: {
      workDate: job.workDate,
      workEndDate: job.workEndDate,
      startTime: job.startTime,
      endTime: job.endTime,
      totalHours: job.totalHours
    },
    agreedPayment: {
      grossAmount: job.grossPay,
      currency: job.currency,
      basis: job.payBasis
    },
    status: ASSIGNMENT_STATUSES.CONFIRMED
  });

  await Job.findByIdAndUpdate(job._id, { $inc: { filledCount: 1 } });

  return { worker, workerToken, application, assignment };
}

describe('WorkMatch GPS-Based Worker Attendance & Employer Manual Attendance System', () => {
  beforeAll(async () => {
    originalMongoUri = process.env.MONGO_URI;
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    process.env.MONGO_URI = replicaSet.getUri();
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
    if (replicaSet) {
      await replicaSet.stop();
    }
    if (originalMongoUri) {
      process.env.MONGO_URI = originalMongoUri;
    } else {
      delete process.env.MONGO_URI;
    }
  });

  describe('1. Worker GPS Check-in within 200-Metre Radius', () => {
    it('accepts check-in when worker GPS coordinates are within 200m of the confirmed job venue', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker, workerToken, assignment } = await createHiredWorker(job, employer);

      // Very close location: ~50 meters away from VENUE_LAT, VENUE_LNG
      // 0.0004 deg lat is ~44.4 meters
      const workerLat = VENUE_LAT + 0.0004;
      const workerLng = VENUE_LNG + 0.0001;

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: workerLat,
          longitude: workerLng,
          accuracy: 15
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/GPS location has been verified/i);
      expect(res.body.attendance.status).toBe(ATTENDANCE_STATUSES.PRESENT_GPS);
      expect(res.body.attendance.method).toBe(ATTENDANCE_METHODS.GPS);
      expect(res.body.attendance.distanceMeters).toBeLessThanOrEqual(200);
      expect(res.body.attendance.checkedInAt).toBeDefined();

      // Verify in Database
      const attRecord = await Attendance.findOne({ job: job._id, worker: worker._id });
      expect(attRecord).not.toBeNull();
      expect(attRecord.status).toBe(ATTENDANCE_STATUSES.PRESENT_GPS);
      expect(attRecord.method).toBe(ATTENDANCE_METHODS.GPS);
      expect(attRecord.checkInCoordinates.latitude).toBeCloseTo(workerLat);
      expect(attRecord.checkInCoordinates.longitude).toBeCloseTo(workerLng);
      expect(attRecord.accuracyMeters).toBe(15);
      expect(attRecord.distanceMeters).toBeLessThanOrEqual(200);
      expect(attRecord.auditHistory.length).toBe(1);
      expect(attRecord.auditHistory[0].action).toBe('CHECK_IN');

      // Verify assignment was updated with attendance note
      const dbAssignment = await Assignment.findById(assignment._id);
      expect(dbAssignment.attendance.checkedInAt).toBeDefined();
      expect(dbAssignment.attendance.notes).toMatch(/GPS Verified/i);
    });

    it('rejects check-in when worker GPS coordinates are outside the 200m radius', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { workerToken } = await createHiredWorker(job, employer);

      // Distant location: ~1.5 km away (0.015 degrees lat is ~1.66 km)
      const distantLat = VENUE_LAT + 0.015;
      const distantLng = VENUE_LNG;

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: distantLat,
          longitude: distantLng,
          accuracy: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('OUTSIDE_ATTENDANCE_RADIUS');
      expect(res.body.message).toMatch(/outside the permitted 200-metre attendance area/i);
      expect(res.body.distanceMeters).toBeGreaterThan(200);
    });

    it('rejects invalid or missing GPS coordinates', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { workerToken } = await createHiredWorker(job, employer);

      const res1 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: 150, // Out of bounds
          longitude: 74.3720
        });

      expect(res1.status).toBe(400);
      expect(res1.body.message).toMatch(/Valid GPS coordinates/i);

      const res2 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: 0,
          longitude: 0 // Ambiguous [0,0]
        });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/Valid GPS coordinates/i);
    });

    it('rejects check-in with poor GPS accuracy (> 300m)', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { workerToken } = await createHiredWorker(job, employer);

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG,
          accuracy: 450 // Poor accuracy
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('POOR_GPS_ACCURACY');
      expect(res.body.message).toMatch(/stronger GPS signal/i);
    });

    it('prevents duplicate check-in if worker is already marked present', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { workerToken } = await createHiredWorker(job, employer);

      // First check-in
      const res1 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG,
          accuracy: 10
        });
      expect(res1.status).toBe(200);

      // Second check-in attempt
      const res2 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG,
          accuracy: 10
        });

      expect(res2.status).toBe(400);
      expect(res2.body.code).toBe('ALREADY_CHECKED_IN');
      expect(res2.body.message).toMatch(/already been marked/i);
    });

    it('rejects check-in if worker is not selected or hired for the job', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { token: unhiredWorkerToken } = await createUser(ROLES.WORKER);

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${unhiredWorkerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('WORKER_NOT_SELECTED');
      expect(res.body.message).toMatch(/not selected/i);
    });

    it('rejects check-in if job does not have verified GPS coordinates configured', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      // Job with missing/unconfirmed coordinates [0, 0]
      const uncalibratedJob = await createJobWithConfirmedGPS(employer._id, {
        location: { type: 'Point', coordinates: [0, 0] },
        coordinatesConfirmed: false
      });
      const { workerToken } = await createHiredWorker(uncalibratedJob, employer);

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: uncalibratedJob._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('JOB_COORDINATES_MISSING');
      expect(res.body.message).toMatch(/coordinates/i);
    });
  });

  describe('2. Employer Manual Attendance & Corrections', () => {
    it('allows the job employer to manually mark a selected worker as Present with mandatory reason', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker } = await createHiredWorker(job, employer);

      const res = await request(app)
        .post(`/api/attendance/job/${job._id}/worker/${worker._id}/manual`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.PRESENT_MANUAL,
          reason: 'Worker is on site at banquet registration; phone dead.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attendance.status).toBe(ATTENDANCE_STATUSES.PRESENT_MANUAL);
      expect(res.body.attendance.method).toBe(ATTENDANCE_METHODS.MANUAL);

      // Verify DB record and audit log
      const att = await Attendance.findOne({ job: job._id, worker: worker._id });
      expect(att.status).toBe(ATTENDANCE_STATUSES.PRESENT_MANUAL);
      expect(att.reason).toBe('Worker is on site at banquet registration; phone dead.');
      expect(att.auditHistory.length).toBe(1);
      expect(att.auditHistory[0].action).toBe('MANUAL_PRESENT');
      expect(att.auditHistory[0].reason).toMatch(/phone dead/i);
    });

    it('allows the job employer to manually mark a worker as Absent with mandatory reason', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker } = await createHiredWorker(job, employer);

      const res = await request(app)
        .post(`/api/attendance/job/${job._id}/worker/${worker._id}/manual`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.ABSENT_MANUAL,
          reason: 'Worker did not show up by 10:00 AM without notice.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attendance.status).toBe(ATTENDANCE_STATUSES.ABSENT_MANUAL);

      const att = await Attendance.findOne({ job: job._id, worker: worker._id });
      expect(att.status).toBe(ATTENDANCE_STATUSES.ABSENT_MANUAL);
      expect(att.auditHistory[0].action).toBe('MANUAL_ABSENT');
    });

    it('rejects manual marking without a valid reason', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker } = await createHiredWorker(job, employer);

      const res = await request(app)
        .post(`/api/attendance/job/${job._id}/worker/${worker._id}/manual`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.PRESENT_MANUAL,
          reason: '  ' // Empty reason
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/clear reason/i);
    });

    it('prevents accidental silent overwrite of GPS-verified attendance without explicit correction', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker, workerToken } = await createHiredWorker(job, employer);

      // Worker checks in with GPS
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      // Employer tries regular manual marking without allowCorrection flag
      const overwriteRes = await request(app)
        .post(`/api/attendance/job/${job._id}/worker/${worker._id}/manual`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.ABSENT_MANUAL,
          reason: 'Employer accidentally clicked absent.'
        });

      expect(overwriteRes.status).toBe(409);
      expect(overwriteRes.body.code).toBe('REQUIRES_EXPLICIT_CORRECTION');
      expect(overwriteRes.body.message).toMatch(/GPS-verified/i);
    });

    it('allows explicit correction of an attendance record and preserves audit trail', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id);
      const { worker, workerToken } = await createHiredWorker(job, employer);

      // 1. Worker checks in with GPS
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      const attRecord = await Attendance.findOne({ job: job._id, worker: worker._id });

      // 2. Employer explicitly corrects the record
      const correctRes = await request(app)
        .patch(`/api/attendance/${attRecord._id}/correction`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.ABSENT_MANUAL,
          reason: 'Worker checked in via GPS but left site 5 minutes later without authorization.'
        });

      expect(correctRes.status).toBe(200);
      expect(correctRes.body.success).toBe(true);
      expect(correctRes.body.attendance.status).toBe(ATTENDANCE_STATUSES.ABSENT_MANUAL);

      // 3. Inspect audit trail
      const auditRes = await request(app)
        .get(`/api/attendance/${attRecord._id}/audit`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.auditHistory.length).toBe(2);
      expect(auditRes.body.auditHistory[0].action).toBe('CHECK_IN');
      expect(auditRes.body.auditHistory[0].newStatus).toBe(ATTENDANCE_STATUSES.PRESENT_GPS);
      expect(auditRes.body.auditHistory[1].action).toBe('CORRECTION');
      expect(auditRes.body.auditHistory[1].previousStatus).toBe(ATTENDANCE_STATUSES.PRESENT_GPS);
      expect(auditRes.body.auditHistory[1].newStatus).toBe(ATTENDANCE_STATUSES.ABSENT_MANUAL);
    });
  });

  describe('3. Job-wise Attendance Separation & Authorization', () => {
    it('prevents an employer from viewing or modifying attendance for another employer job', async () => {
      const { user: employer1 } = await createUser(ROLES.EMPLOYER);
      const { user: employer2, token: employer2Token } = await createUser(ROLES.EMPLOYER);

      const job1 = await createJobWithConfirmedGPS(employer1._id);
      const { worker } = await createHiredWorker(job1, employer1);

      // Employer 2 attempts to view Job 1 attendance
      const viewRes = await request(app)
        .get(`/api/attendance/job/${job1._id}`)
        .set('Authorization', `Bearer ${employer2Token}`);
      expect(viewRes.status).toBe(403);

      // Employer 2 attempts to mark manual attendance on Job 1
      const markRes = await request(app)
        .post(`/api/attendance/job/${job1._id}/worker/${worker._id}/manual`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({
          status: ATTENDANCE_STATUSES.PRESENT_MANUAL,
          reason: 'Unauthorized attempt'
        });
      expect(markRes.status).toBe(403);
    });

    it('returns only selected workers for the job and accurate summary counts', async () => {
      const { user: employer, token: employerToken } = await createUser(ROLES.EMPLOYER);
      const job = await createJobWithConfirmedGPS(employer._id, { openings: 3 });

      // Worker 1: Hired and checks in with GPS
      const { worker: worker1, workerToken: token1 } = await createHiredWorker(job, employer);
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          jobId: job._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      // Worker 2: Hired, manual marked Present
      const { worker: worker2 } = await createHiredWorker(job, employer);
      await request(app)
        .post(`/api/attendance/job/${job._id}/worker/${worker2._id}/manual`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: ATTENDANCE_STATUSES.PRESENT_MANUAL,
          reason: 'Present on site'
        });

      // Worker 3: Hired, still Pending check-in
      await createHiredWorker(job, employer);

      // Query job attendance detail
      const detailRes = await request(app)
        .get(`/api/attendance/job/${job._id}`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.summary.totalSelected).toBe(3);
      expect(detailRes.body.summary.presentCount).toBe(2);
      expect(detailRes.body.summary.presentGpsCount).toBe(1);
      expect(detailRes.body.summary.presentManualCount).toBe(1);
      expect(detailRes.body.summary.pendingCount).toBe(1);
      expect(detailRes.body.summary.absentCount).toBe(0);
      expect(detailRes.body.workers.length).toBe(3);
    });
  });

  describe('4. Worker Attendance History', () => {
    it('returns worker complete attendance history for all their confirmed shifts', async () => {
      const { user: employer } = await createUser(ROLES.EMPLOYER);
      const job1 = await createJobWithConfirmedGPS(employer._id, { title: 'Morning Hospitality' });
      const job2 = await createJobWithConfirmedGPS(employer._id, { title: 'Evening Banquet' });

      const { worker, workerToken } = await createHiredWorker(job1, employer);

      // Also hire worker for job2
      await Application.create({
        job: job2._id,
        worker: worker._id,
        employer: employer._id,
        status: APPLICATION_STATUSES.HIRED
      });
      await Assignment.create({
        job: job2._id,
        worker: worker._id,
        employer: employer._id,
        application: (await Application.findOne({ job: job2._id, worker: worker._id }))._id,
        agreedSchedule: {
          workDate: job2.workDate,
          workEndDate: job2.workEndDate,
          startTime: job2.startTime,
          endTime: job2.endTime,
          totalHours: 8
        },
        agreedPayment: { grossAmount: 800, currency: 'INR', basis: 'shift' },
        status: ASSIGNMENT_STATUSES.CONFIRMED
      });

      // Check in to Job 1 via GPS
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          jobId: job1._id.toString(),
          latitude: VENUE_LAT,
          longitude: VENUE_LNG
        });

      // Fetch worker attendance history
      const res = await request(app)
        .get('/api/attendance/my-history')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history.length).toBe(2);

      const job1Att = res.body.history.find((h) => h.job._id.toString() === job1._id.toString());
      const job2Att = res.body.history.find((h) => h.job._id.toString() === job2._id.toString());

      expect(job1Att.status).toBe(ATTENDANCE_STATUSES.PRESENT_GPS);
      expect(job2Att.status).toBe(ATTENDANCE_STATUSES.PENDING);
    });
  });
});
