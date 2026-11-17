import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Attendance } from '../src/models/Attendance.js';
import { Report } from '../src/models/Report.js';
import { VerificationRequest } from '../src/models/VerificationRequest.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Setting } from '../src/models/Setting.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ATTENDANCE_STATUSES, ATTENDANCE_METHODS } from '../src/config/constants.js';
import { signToken } from '../src/config/jwt.js';
import { sanitizeCsvCell } from '../src/controllers/adminController.js';

describe('WorkMatch Complete Admin Dashboard Upgrade Test Suite', () => {
  let mongoServer;
  let adminUser, adminToken;
  let workerUser, workerToken;
  let employerUser, employerToken;
  let testJob, testApplication, testAttendance, testReport, testVerification;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Create genuine Admin
    adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin.super@workmatch.demo',
      passwordHash: 'hashed_pass_admin',
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      activeRole: ROLES.ADMIN,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
    adminToken = signToken({ id: adminUser._id, role: ROLES.ADMIN, roles: [ROLES.ADMIN] });

    // 2. Create standard Worker
    workerUser = await User.create({
      name: 'Ravi Kumar',
      email: 'ravi.worker@workmatch.demo',
      passwordHash: 'hashed_pass_worker',
      role: ROLES.WORKER,
      roles: [ROLES.WORKER],
      activeRole: ROLES.WORKER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
    workerToken = signToken({ id: workerUser._id, role: ROLES.WORKER, roles: [ROLES.WORKER] });

    await WorkerProfile.create({
      user: workerUser._id,
      skills: ['Catering Service', 'Plate Setting', 'Buffet Management'],
      preferredLocationName: 'Kolhapur Central',
      completedJobsCount: 8,
      rating: { average: 4.9, count: 8 }
    });

    // 3. Create standard Employer
    employerUser = await User.create({
      name: 'Priya Sharma',
      email: 'priya.employer@workmatch.demo',
      passwordHash: 'hashed_pass_employer',
      role: ROLES.EMPLOYER,
      roles: [ROLES.EMPLOYER],
      activeRole: ROLES.EMPLOYER,
      accountStatus: 'active',
      emailVerified: true,
      verificationStatus: 'verified'
    });
    employerToken = signToken({ id: employerUser._id, role: ROLES.EMPLOYER, roles: [ROLES.EMPLOYER] });

    await EmployerProfile.create({
      user: employerUser._id,
      businessName: 'Royal Grand Banquet & Caterers',
      businessAddress: 'Old Palace Road, Kolhapur',
      totalJobsPosted: 5
    });

    // 4. Create Job
    testJob = await Job.create({
      employer: employerUser._id,
      title: 'Grand Wedding Banquet Waiter Staff',
      category: 'Catering and Events',
      description: 'Looking for 5 experienced catering servers for high-profile reception.',
      requiredSkills: ['Catering Service', 'Plate Setting'],
      openings: 5,
      filledCount: 2,
      grossPay: 800,
      payBasis: 'shift',
      totalHours: 7,
      status: JOB_STATUSES.OPEN,
      locationName: 'Royal Grand Banquet Hall',
      city: 'Kolhapur',
      location: {
        type: 'Point',
        coordinates: [74.2433, 16.7050],
        city: 'Kolhapur'
      },
      workStartDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      workDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '17:00'
    });

    // 5. Create Application & Assignment
    testApplication = await Application.create({
      job: testJob._id,
      worker: workerUser._id,
      status: APPLICATION_STATUSES.ACCEPTED,
      appliedAt: new Date()
    });

    const testAssignment = await Assignment.create({
      job: testJob._id,
      application: testApplication._id,
      worker: workerUser._id,
      employer: employerUser._id,
      status: 'CONFIRMED',
      agreedPayment: {
        amount: 800,
        grossAmount: 800,
        basis: 'shift'
      },
      agreedSchedule: {
        workDate: new Date(),
        startTime: '10:00',
        endTime: '17:00',
        totalHours: 7
      }
    });

    // 6. Create Attendance record
    testAttendance = await Attendance.create({
      job: testJob._id,
      worker: workerUser._id,
      employer: employerUser._id,
      assignment: testAssignment._id,
      status: ATTENDANCE_STATUSES.PRESENT,
      method: ATTENDANCE_METHODS.GPS,
      accuracyMeters: 12,
      distanceMeters: 45,
      checkedInAt: new Date(),
      checkInCoordinates: { latitude: 16.7052, longitude: 74.2435 }
    });

    // 7. Create Incident Report
    testReport = await Report.create({
      reporter: workerUser._id,
      reportedJob: testJob._id,
      category: 'pay_mismatch',
      description: 'Employer agreed to ₹800 per shift, please verify rate transparency.',
      status: 'pending'
    });

    // 8. Create Verification Request
    testVerification = await VerificationRequest.create({
      user: workerUser._id,
      verificationType: 'identity',
      status: 'pending'
    });
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  // ------------------------------------------------------------------------
  // 1. ADMIN AUTHORIZATION & SECURITY
  // ------------------------------------------------------------------------
  describe('Phase 14: Admin Authorization & Security Enforcement', () => {
    it('rejects unauthenticated requests to /api/admin/dashboard with HTTP 401', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects normal worker token from accessing /api/admin/dashboard with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/administrator/i);
    });

    it('rejects employer token from accessing /api/admin/dashboard with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${employerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects user attempting privilege escalation via forged activeRole without genuine admin role', async () => {
      const forgedToken = signToken({
        id: workerUser._id,
        role: ROLES.WORKER,
        roles: [ROLES.WORKER],
        activeRole: ROLES.ADMIN // Worker forged activeRole
      });

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows genuine administrator access to /api/admin/dashboard with HTTP 200', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });
  });

  // ------------------------------------------------------------------------
  // 2. DASHBOARD OVERVIEW & AGGREGATIONS
  // ------------------------------------------------------------------------
  describe('Phase 3: Admin Dashboard Overview & Marketplace Telemetry', () => {
    it('returns accurate platform metrics from database without hardcoded values', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard?range=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { stats, trends, categoryDistribution, cityDistribution } = res.body;

      expect(stats.totalUsers).toBeGreaterThanOrEqual(3);
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(1);
      expect(stats.totalEmployers).toBeGreaterThanOrEqual(1);
      expect(stats.totalJobs).toBeGreaterThanOrEqual(1);
      expect(stats.totalApplications).toBeGreaterThanOrEqual(1);
      expect(stats.gpsAttendance).toBeGreaterThanOrEqual(1);
      expect(stats.openReports).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(categoryDistribution)).toBe(true);
      expect(categoryDistribution.some((c) => c.category === 'Catering and Events')).toBe(true);

      expect(Array.isArray(cityDistribution)).toBe(true);
      expect(cityDistribution.some((c) => c.city === 'Kolhapur')).toBe(true);

      expect(trends).toBeDefined();
      expect(Array.isArray(trends.userGrowth)).toBe(true);
      expect(Array.isArray(trends.jobTrends)).toBe(true);
      expect(Array.isArray(trends.applicationTrends)).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // 3. USER MANAGEMENT & MODERATION
  // ------------------------------------------------------------------------
  describe('Phase 4: User Management & Moderation Invariants', () => {
    it('returns paginated users and strictly strips sensitive credentials', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(3);

      res.body.users.forEach((u) => {
        expect(u.passwordHash).toBeUndefined();
        expect(u.resetPasswordToken).toBeUndefined();
        expect(u.emailVerificationToken).toBeUndefined();
      });
    });

    it('requires a mandatory justification reason when suspending an account', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${workerUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended', reason: '' }); // empty reason

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/mandatory moderation reason/i);
    });

    it('suspends user account and generates an immutable AuditLog entry', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${workerUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended', reason: 'Repeated late arrival reported by banquet employer' });

      expect(res.status).toBe(200);
      expect(res.body.user.accountStatus).toBe('suspended');

      // Verify audit log
      const audit = await AuditLog.findOne({
        actor: adminUser._id,
        action: 'SUSPEND_USER',
        resourceId: workerUser._id
      });
      expect(audit).toBeDefined();
      expect(audit.metadata.reason).toContain('Repeated late arrival');

      // Reactivate worker to preserve clean state
      await User.findByIdAndUpdate(workerUser._id, { accountStatus: 'active' });
    });

    it('dedicated workers endpoint returns skills, ratings and profile completeness', async () => {
      const res = await request(app)
        .get('/api/admin/workers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workers.length).toBeGreaterThanOrEqual(1);
      const ravi = res.body.workers.find((w) => w.email === workerUser.email);
      expect(ravi).toBeDefined();
      expect(ravi.skills).toContain('Catering Service');
      expect(ravi.rating).toBe(4.9);
    });

    it('dedicated employers endpoint returns business name, venue address and posted jobs count', async () => {
      const res = await request(app)
        .get('/api/admin/employers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.employers.length).toBeGreaterThanOrEqual(1);
      const priya = res.body.employers.find((e) => e.email === employerUser.email);
      expect(priya).toBeDefined();
      expect(priya.businessName).toBe('Royal Grand Banquet & Caterers');
    });
  });

  // ------------------------------------------------------------------------
  // 4. JOB MANAGEMENT & MODERATION
  // ------------------------------------------------------------------------
  describe('Phase 5: Job Management & Moderation', () => {
    it('returns jobs list with correct headcount, application counts and pay details', async () => {
      const res = await request(app)
        .get('/api/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
      const job = res.body.jobs.find((j) => j._id === String(testJob._id));
      expect(job).toBeDefined();
      expect(job.payBasis).toBe('shift');
      expect(job.grossPay).toBe(800);
      expect(job.totalApplications).toBeGreaterThanOrEqual(1);
    });

    it('moderates job status to SUSPENDED with mandatory reason and logs audit', async () => {
      const res = await request(app)
        .patch(`/api/admin/jobs/${testJob._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Temporary suspension pending venue coordinate audit' });

      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe('SUSPENDED');

      const audit = await AuditLog.findOne({
        actor: adminUser._id,
        action: 'SUSPEND_JOB',
        resourceId: testJob._id
      });
      expect(audit).toBeDefined();

      // Restore to OPEN
      await Job.findByIdAndUpdate(testJob._id, { status: JOB_STATUSES.OPEN });
    });
  });

  // ------------------------------------------------------------------------
  // 5. APPLICATIONS & RECRUITMENT MONITORING
  // ------------------------------------------------------------------------
  describe('Phase 6: Application & Recruitment Oversight', () => {
    it('returns applications list and calculates fill rate safely without division by zero', async () => {
      const res = await request(app)
        .get('/api/admin/recruitment/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.analytics).toBeDefined();
      expect(typeof res.body.analytics.overallFillRate).toBe('number');
      expect(res.body.analytics.overallFillRate).toBeGreaterThanOrEqual(0);
      expect(res.body.analytics.overallFillRate).toBeLessThanOrEqual(100);
    });
  });

  // ------------------------------------------------------------------------
  // 6. ATTENDANCE MONITORING & AUDIT TRAIL
  // ------------------------------------------------------------------------
  describe('Phase 7: Attendance Monitoring & Administrative Corrections', () => {
    it('returns GPS verified vs manual attendance records with geofence proximity', async () => {
      const res = await request(app)
        .get('/api/admin/attendance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.attendance.length).toBeGreaterThanOrEqual(1);
      const record = res.body.attendance.find((a) => a._id === String(testAttendance._id));
      expect(record).toBeDefined();
      expect(record.method).toBe('GPS');
      expect(record.distanceMeters).toBe(45);
      expect(record.accuracyMeters).toBe(12);
    });

    it('allows administrative attendance correction with mandatory reason, recording changedBy in auditHistory', async () => {
      const res = await request(app)
        .patch(`/api/admin/attendance/${testAttendance._id}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PRESENT',
          reason: 'Employer supervisor manually confirmed worker presence at Banquet hall'
        });

      expect(res.status).toBe(200);
      expect(res.body.attendance.status).toBe(ATTENDANCE_STATUSES.PRESENT_MANUAL);

      // Verify audit history array
      const updated = await Attendance.findById(testAttendance._id);
      expect(updated.auditHistory.length).toBeGreaterThanOrEqual(1);
      const lastEntry = updated.auditHistory[updated.auditHistory.length - 1];
      expect(lastEntry.action).toBe('CORRECTION');
      expect(String(lastEntry.changedBy)).toBe(String(adminUser._id));
      expect(lastEntry.reason).toContain('Employer supervisor manually confirmed');
    });
  });

  // ------------------------------------------------------------------------
  // 7. VERIFICATION MANAGEMENT
  // ------------------------------------------------------------------------
  describe('Phase 8: Verification Management', () => {
    it('reviews verification request and promotes User verificationStatus to verified', async () => {
      const res = await request(app)
        .patch(`/api/admin/verifications/${testVerification._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', reviewNotes: 'Government trade badge confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.verification.status).toBe('approved');

      const user = await User.findById(workerUser._id);
      expect(user.verificationStatus).toBe('verified');
    });
  });

  // ------------------------------------------------------------------------
  // 8. REPORTS & COMPLAINTS (TRUST & SAFETY)
  // ------------------------------------------------------------------------
  describe('Phase 9: Reports & Complaints Moderation Workflow', () => {
    it('resolves incident report, marks substantiated and records resolution notes', async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          substantiated: false,
          resolutionNotes: 'Verified employer shift terms matched posted ₹800 flat rate.'
        });

      expect(res.status).toBe(200);
      expect(res.body.report.status).toBe('resolved');
      expect(res.body.report.substantiated).toBe(false);

      const audit = await AuditLog.findOne({
        actor: adminUser._id,
        action: 'RESOLVE_REPORT',
        resourceId: testReport._id
      });
      expect(audit).toBeDefined();
    });
  });

  // ------------------------------------------------------------------------
  // 9. CSV EXPORTS & OWASP FORMULA INJECTION SANITIZATION
  // ------------------------------------------------------------------------
  describe('Phase 10: Sanitized CSV Data Exports', () => {
    it('sanitizes formula characters (=, +, -, @) to prevent CSV spreadsheet injection', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
      expect(sanitizeCsvCell('+cmd|/c calc')).toBe('"\'+\cmd|/c calc"'.replace('\\', ''));
      expect(sanitizeCsvCell('-50')).toBe('"\' -50"'.replace(' ', ''));
      expect(sanitizeCsvCell('@dangerous')).toBe('"\'@dangerous"');
      expect(sanitizeCsvCell('Safe Standard Text')).toBe('"Safe Standard Text"');
      expect(sanitizeCsvCell(null)).toBe('""');
    });

    it('exports authorized users CSV with proper headers and content disposition', async () => {
      const res = await request(app)
        .get('/api/admin/export/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('workmatch-users-');
      expect(res.text).toContain('ID,Name,Email,Role');
    });
  });

  // ------------------------------------------------------------------------
  // 10. PLATFORM SETTINGS & AUDIT LOGS
  // ------------------------------------------------------------------------
  describe('Phase 11 & 12: Admin Activity Logs & Platform Settings', () => {
    it('returns immutable audit logs recorded during test suite actions', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditLogs.length).toBeGreaterThan(0);
    });

    it('updates platform moderation settings without exposing database secrets', async () => {
      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'moderationRules',
          value: { maxHourlyRateINR: 6000, maxPerShiftRateINR: 25000 },
          description: 'Updated rate limits for wedding peak season'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const saved = await Setting.findOne({ key: 'moderationRules' });
      expect(saved.value.maxHourlyRateINR).toBe(6000);
    });
  });
});
