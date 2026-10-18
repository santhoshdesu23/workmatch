import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Report } from '../src/models/Report.js';
import { Review } from '../src/models/Review.js';
import { Notification } from '../src/models/Notification.js';
import { JobChangeHistory } from '../src/models/JobChangeHistory.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { ROLES, JOB_STATUSES, ASSIGNMENT_STATUSES } from '../src/config/constants.js';

describe('WorkMatch TrustTrack Feature Test Suite', () => {
  let employerToken;
  let employerId;
  let employer2Token;
  let employer2Id;
  let workerToken;
  let workerId;
  let adminToken;
  let adminId;

  const timestamp = Date.now();
  const employerEmail = `trusttrack.emp.${timestamp}@example.com`;
  const employer2Email = `trusttrack.emp2.${timestamp}@example.com`;
  const workerEmail = `trusttrack.worker.${timestamp}@example.com`;
  const adminEmail = `trusttrack.admin.${timestamp}@example.com`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Create Employer 1
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'TrustTrack Employer One',
      email: employerEmail,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'TrustTrack Prime Logistics'
    });
    employerToken = empRes.body.token;
    employerId = empRes.body.user.id;

    // 2. Create Employer 2
    const emp2Res = await request(app).post('/api/auth/register').send({
      name: 'TrustTrack Employer Two',
      email: employer2Email,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Second Operations Co'
    });
    employer2Token = emp2Res.body.token;
    employer2Id = emp2Res.body.user.id;

    // 3. Create Worker
    const workerRes = await request(app).post('/api/auth/register').send({
      name: 'TrustTrack Verified Worker',
      email: workerEmail,
      password: 'Password123!',
      role: ROLES.WORKER
    });
    workerToken = workerRes.body.token;
    workerId = workerRes.body.user.id;

    // 4. Create Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'TrustTrack Compliance Admin',
      email: adminEmail,
      password: 'Password123!',
      role: ROLES.EMPLOYER,
      businessName: 'Admin Operations'
    });
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;
    await User.findByIdAndUpdate(adminId, { role: ROLES.ADMIN, emailVerified: true });

    // Set emailVerified = true for all test accounts
    await User.updateMany(
      { email: { $in: [employerEmail, employer2Email, workerEmail, adminEmail] } },
      { $set: { emailVerified: true } }
    );
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // Feature A: Structured and Confirmed Job Details
  // =========================================================================
  describe('Feature A: Structured & Confirmed Job Details', () => {
    it('successfully publishes a job with valid structured details and explicit confirmation', async () => {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() + 5);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Warehouse Inventory Associate',
          description: 'Organize incoming parcels and pallet shipments in logistics bay.',
          category: 'Warehouse and packing',
          openings: 2,
          locationName: 'Logistics Center Dock 4, Seattle WA',
          coordinates: [-122.3321, 47.6062],
          workDate: shiftDate.toISOString(),
          startTime: '08:00',
          endTime: '16:30',
          breakDurationMinutes: 30,
          totalHours: 8,
          grossPay: 28,
          payBasis: 'hourly',
          requiredSkills: ['Inventory Scanning', 'Pallet Jack'],
          dressCode: 'Steel-toed boots, high-vis vest provided',
          detailsConfirmed: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.detailsConfirmed).toBe(true);
      expect(res.body.job.detailsConfirmedAt).toBeDefined();
      expect(res.body.job.detailsConfirmedBy.toString()).toBe(employerId.toString());

      // Invariant: confirming job details does NOT mark employer identity as verified
      const empUser = await User.findById(employerId);
      expect(empUser.verificationStatus).toBe('unverified');
    });

    it('rejects publishing a job with a work date in the past', async () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Expired Shift Posting',
          description: 'This job has a work date that has already passed.',
          category: 'Warehouse and packing',
          locationName: 'Past Venue',
          workDate: pastDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          grossPay: 25,
          totalHours: 8
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/past/i);
    });

    it('rejects publishing a job with invalid or non-positive pay', async () => {
      const futureDate = new Date(Date.now() + 86400000);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Zero Pay Volunteer Attempt',
          description: 'Trying to post an invalid shift with 0 pay value.',
          category: 'Event assistance',
          locationName: 'Convention Center',
          workDate: futureDate.toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          grossPay: 0,
          totalHours: 8
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/gross pay/i);
    });

    it('rejects publishing with missing shift hours or invalid duration', async () => {
      const futureDate = new Date(Date.now() + 86400000);

      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Invalid Duration Shift',
          description: 'Shift missing end time and zero total hours.',
          category: 'Event assistance',
          locationName: 'Convention Center',
          workDate: futureDate.toISOString(),
          startTime: '09:00',
          grossPay: 20,
          totalHours: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/start and end times|total hours/i);
    });
  });

  // =========================================================================
  // Feature B: Job Change History & Protection of Commitments
  // =========================================================================
  describe('Feature B: Job Change History & Commitments Protection', () => {
    let testJob;

    beforeAll(async () => {
      const futureDate = new Date(Date.now() + 3 * 86400000);
      testJob = await Job.create({
        employer: employerId,
        title: 'Original Catering Server Shift',
        description: 'Original catering duties for wedding reception',
        category: 'Wedding and catering support',
        openings: 2,
        filledCount: 0,
        locationName: 'Grand Hyatt Ballroom',
        workDate: futureDate,
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        grossPay: 22,
        payBasis: 'hourly',
        detailsConfirmed: true,
        status: JOB_STATUSES.OPEN
      });
    });

    it('rejects unauthorized job edits by a different employer', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({ title: 'Hijacked Job Title' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('records an auditable JobChangeHistory entry on material job changes', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${testJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          grossPay: 26, // Increased pay
          startTime: '11:00', // Changed start time
          reason: 'Adjusted event call time and boosted pay to meet venue timeline.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.grossPay).toBe(26);

      // Verify JobChangeHistory in DB
      const historyEntries = await JobChangeHistory.find({ job: testJob._id }).sort({ createdAt: -1 });
      expect(historyEntries.length).toBeGreaterThan(0);

      const latest = historyEntries[0];
      expect(latest.actor.toString()).toBe(employerId.toString());
      expect(latest.actorRole).toBe('employer');
      expect(latest.changedFields).toContain('grossPay');
      expect(latest.changedFields).toContain('startTime');
      expect(latest.isMaterial).toBe(true);
      expect(latest.reason).toMatch(/venue timeline/i);

      // Verify specific change diff
      const payChange = latest.changes.find((c) => c.field === 'grossPay');
      expect(payChange).toBeDefined();
      expect(payChange.oldValue).toBe(22);
      expect(payChange.newValue).toBe(26);
      expect(payChange.isMaterial).toBe(true);
    });

    it('provides public/worker read access to job history without leaking credentials', async () => {
      const res = await request(app).get(`/api/jobs/${testJob._id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.history.length).toBeGreaterThan(0);

      const item = res.body.history[0];
      expect(item.changedFields).toBeDefined();
      expect(item.changes).toBeDefined();
      // Ensure no password or sensitive tokens leaked
      expect(item.actor?.passwordHash).toBeUndefined();
      expect(item.actor?.emailVerificationToken).toBeUndefined();
    });

    it('enforces active assignment protection: cannot decrease pay after hiring', async () => {
      // Simulate confirmed hire on testJob
      const futureDate = new Date(Date.now() + 4 * 86400000);
      const committedJob = await Job.create({
        employer: employerId,
        title: 'Committed Loading Shift',
        description: 'Loading stage equipment with active worker hired.',
        category: 'Event assistance',
        openings: 2,
        filledCount: 1,
        locationName: 'Concert Hall',
        workDate: futureDate,
        startTime: '14:00',
        endTime: '22:00',
        totalHours: 8,
        grossPay: 30,
        payBasis: 'hourly',
        status: JOB_STATUSES.OPEN
      });

      const fakeApp = await Application.create({
        job: committedJob._id,
        worker: workerId,
        status: 'HIRED'
      });

      await Assignment.create({
        job: committedJob._id,
        worker: workerId,
        employer: employerId,
        application: fakeApp._id,
        agreedSchedule: {
          workDate: futureDate,
          startTime: '14:00',
          endTime: '22:00',
          totalHours: 8
        },
        agreedPayment: { grossAmount: 30, currency: 'USD', basis: 'hourly' },
        status: ASSIGNMENT_STATUSES.CONFIRMED
      });

      // Attempt to decrease pay from $30 to $20
      const decreaseRes = await request(app)
        .patch(`/api/jobs/${committedJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ grossPay: 20 });

      expect(decreaseRes.status).toBe(400);
      expect(decreaseRes.body.message).toMatch(/cannot reduce pay rate/i);

      // Attempt to alter shift start time under active assignment
      const timeChangeRes = await request(app)
        .patch(`/api/jobs/${committedJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ startTime: '16:00' });

      expect(timeChangeRes.status).toBe(400);
      expect(timeChangeRes.body.message).toMatch(/cannot alter work date or shift times/i);
    });
  });

  // =========================================================================
  // Feature C: Notify Affected Applicants & Reconfirmation
  // =========================================================================
  describe('Feature C: Notify Affected Applicants & Reconfirmation', () => {
    let notifyJob;
    let workerApplication;

    beforeAll(async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      notifyJob = await Job.create({
        employer: employerId,
        title: 'Convention Registration Desk Staff',
        description: 'Check in attendees and hand out badges',
        category: 'Event assistance',
        openings: 3,
        locationName: 'Convention Center Level 2',
        workDate: futureDate,
        startTime: '08:30',
        endTime: '16:30',
        totalHours: 8,
        grossPay: 24,
        payBasis: 'hourly',
        status: JOB_STATUSES.OPEN
      });

      // Worker applies to this job
      const applyRes = await request(app)
        .post(`/api/jobs/${notifyJob._id}/apply`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ message: 'I have front-desk registration experience!' });

      expect(applyRes.status).toBe(201);
      workerApplication = applyRes.body.application;
    });

    it('creates in-app notifications and updates decisionHistory when job details change materially', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${notifyJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          grossPay: 27,
          locationName: 'Convention Center Main Lobby (Updated Gate)',
          reason: 'Relocated check-in desk to front lobby and increased pay.'
        });

      expect(res.status).toBe(200);

      // Check notification sent to worker
      const notification = await Notification.findOne({
        recipient: workerId,
        title: { $regex: /Shift Updated/i }
      }).sort({ createdAt: -1 });

      expect(notification).toBeDefined();
      expect(notification.message).toMatch(/compensation rate|location address/i);

      // Check application decisionHistory entry
      const updatedApp = await Application.findById(workerApplication._id);
      const historyItem = updatedApp.decisionHistory.find((h) =>
        h.note.includes('Material shift update')
      );
      expect(historyItem).toBeDefined();
      expect(historyItem.note).toMatch(/lobby/i);
    });

    it('worker can voluntarily reconfirm their interest after reviewing updated terms', async () => {
      const res = await request(app)
        .post(`/api/applications/${workerApplication._id}/reconfirm`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbApp = await Application.findById(workerApplication._id);
      const reconfirmEntry = dbApp.decisionHistory.find((h) =>
        h.note.includes('reconfirmed interest')
      );
      expect(reconfirmEntry).toBeDefined();
    });

    it('does not send spurious notifications when values remain unchanged', async () => {
      const priorCount = await Notification.countDocuments({ recipient: workerId });

      // Patch with the same existing values
      const res = await request(app)
        .patch(`/api/jobs/${notifyJob._id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          grossPay: 27 // Exactly the same as current
        });

      expect(res.status).toBe(200);
      expect(res.body.changesRecorded).toBe(0);

      const postCount = await Notification.countDocuments({ recipient: workerId });
      expect(postCount).toBe(priorCount);
    });
  });

  // =========================================================================
  // Feature D: Report a Job Mismatch
  // =========================================================================
  describe('Feature D: Report a Job Mismatch', () => {
    let mismatchJob;

    beforeAll(async () => {
      const futureDate = new Date(Date.now() + 5 * 86400000);
      mismatchJob = await Job.create({
        employer: employerId,
        title: 'Dishwashing and Kitchen Help',
        description: 'Night dishwashing shift at Italian Bistro',
        category: 'Restaurant and hospitality',
        openings: 1,
        locationName: 'Luigi Bistro Downtown',
        workDate: futureDate,
        startTime: '17:00',
        endTime: '23:00',
        totalHours: 6,
        grossPay: 20,
        payBasis: 'hourly',
        status: JOB_STATUSES.OPEN
      });
    });

    it('allows a worker to report a discrepancy with specific mismatch category', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          reportedJob: mismatchJob._id,
          category: 'pay_mismatch',
          description: 'Employer verbally stated pay was $14/hr instead of the advertised $20/hr.',
          evidence: 'Shift text messages stating $14 rate.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.report.category).toBe('pay_mismatch');
      expect(res.body.report.status).toBe('pending');

      const savedReport = await Report.findById(res.body.report._id);
      expect(savedReport.reportedUser.toString()).toBe(employerId.toString());
      expect(savedReport.substantiated).toBe(false);
    });

    it('prevents duplicate pending reports for the same job and category by the same worker', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          reportedJob: mismatchJob._id,
          category: 'pay_mismatch',
          description: 'Submitting duplicate report for same issue.'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already have an active report under review/i);
    });

    it('prevents employers from filing reports against their own jobs', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          reportedJob: mismatchJob._id,
          category: 'other',
          description: 'Reporting my own job'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot report their own/i);
    });

    it('admin review workflow records resolution, sets substantiated flag, and writes AuditLog', async () => {
      const pendingReport = await Report.findOne({
        reportedJob: mismatchJob._id,
        category: 'pay_mismatch',
        status: 'pending'
      });
      expect(pendingReport).toBeDefined();

      const res = await request(app)
        .patch(`/api/admin/reports/${pendingReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          substantiated: true,
          resolutionNotes: 'Verified text messages. Employer confirmed wage difference was requested. Official warning issued.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe('resolved');
      expect(res.body.report.substantiated).toBe(true);

      // Verify AuditLog entry exists
      const auditLog = await AuditLog.findOne({
        action: 'RESOLVE_REPORT',
        resourceId: pendingReport._id
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.actor.toString()).toBe(adminId.toString());
      expect(auditLog.metadata.newSubstantiated).toBe(true);
    });
  });

  // =========================================================================
  // Feature E: Evidence-Based Employer Reliability
  // =========================================================================
  describe('Feature E: Evidence-Based Employer Reliability', () => {
    it('returns "Not enough history yet" (hasSufficientHistory: false) when employer has < 3 assignments', async () => {
      const res = await request(app).get(`/api/employers/${employer2Id}/reliability`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reliability.hasSufficientHistory).toBe(false);
      expect(res.body.reliability.metrics.completionRate).toBeNull();
      expect(res.body.reliability.metrics.completedAssignments).toBe(0);
      expect(res.body.reliability.explanations).toBeDefined();
      expect(res.body.reliability.identityVerificationStatus).toBe('unverified');
    });

    it('calculates factual completion rate and substantiated mismatch count when history threshold is met', async () => {
      // Create 3 completed assignments for employer2 and 1 employer cancellation
      const shiftDate = new Date();
      const mockJob = await Job.create({
        employer: employer2Id,
        title: 'Catering Prep Shift',
        description: 'Test shift',
        category: 'Restaurant and hospitality',
        openings: 5,
        locationName: 'Test Kitchen',
        workDate: shiftDate,
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 20
      });

      const mockApp = await Application.create({
        job: mockJob._id,
        worker: workerId,
        status: 'COMPLETED'
      });

      // 3 completed assignments on distinct jobs
      for (let i = 0; i < 3; i++) {
        const completedJob = await Job.create({
          employer: employer2Id,
          title: `Completed Shift ${i + 1}`,
          description: 'Completed shift test',
          category: 'Restaurant and hospitality',
          openings: 1,
          locationName: 'Test Kitchen',
          workDate: shiftDate,
          startTime: '09:00',
          endTime: '17:00',
          totalHours: 8,
          grossPay: 20
        });

        await Assignment.create({
          job: completedJob._id,
          worker: workerId,
          employer: employer2Id,
          application: mockApp._id,
          agreedSchedule: { workDate: shiftDate, startTime: '09:00', endTime: '17:00', totalHours: 8 },
          agreedPayment: { grossAmount: 20, currency: 'USD', basis: 'hourly' },
          status: ASSIGNMENT_STATUSES.COMPLETED
        });
      }

      // 1 cancelled by employer
      const cancelledJob = await Job.create({
        employer: employer2Id,
        title: 'Cancelled Shift',
        description: 'Cancelled shift test',
        category: 'Restaurant and hospitality',
        openings: 1,
        locationName: 'Test Kitchen',
        workDate: shiftDate,
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        grossPay: 20
      });

      await Assignment.create({
        job: cancelledJob._id,
        worker: workerId,
        employer: employer2Id,
        application: mockApp._id,
        agreedSchedule: { workDate: shiftDate, startTime: '09:00', endTime: '17:00', totalHours: 8 },
        agreedPayment: { grossAmount: 20, currency: 'USD', basis: 'hourly' },
        status: ASSIGNMENT_STATUSES.CANCELLED,
        cancelledBy: employer2Id,
        cancellationReason: 'Event cut short'
      });

      // 1 substantiated mismatch report
      await Report.create({
        reporter: workerId,
        reportedUser: employer2Id,
        reportedJob: mockJob._id,
        category: 'pay_mismatch',
        description: 'Paid less than rate',
        status: 'resolved',
        substantiated: true
      });

      // 1 DISMISSED report (must be excluded from substantiated count!)
      await Report.create({
        reporter: workerId,
        reportedUser: employer2Id,
        reportedJob: mockJob._id,
        category: 'location_mismatch',
        description: 'Frivolous claim dismissed',
        status: 'dismissed',
        substantiated: false
      });

      // 1 PENDING report (must be excluded from substantiated count!)
      await Report.create({
        reporter: workerId,
        reportedUser: employer2Id,
        reportedJob: mockJob._id,
        category: 'other',
        description: 'Under investigation',
        status: 'pending',
        substantiated: false
      });

      const res = await request(app).get(`/api/employers/${employer2Id}/reliability`);
      expect(res.status).toBe(200);
      expect(res.body.reliability.hasSufficientHistory).toBe(true);

      const metrics = res.body.reliability.metrics;
      expect(metrics.completedAssignments).toBe(3);
      expect(metrics.totalInitiatedAssignments).toBe(4); // 3 completed + 1 cancelled
      expect(metrics.employerCancellations).toBe(1);
      // 3 completed out of 4 total = 75%
      expect(metrics.completionRate).toBe(75);
      expect(metrics.cancellationRate).toBe(25);
      // Substantiated mismatches must be exactly 1 (dismissed and pending strictly excluded)
      expect(metrics.substantiatedMismatches).toBe(1);
    });

    it('attaches employerReliability object to GET /api/jobs/:jobId', async () => {
      const shiftDate = new Date();
      const testJob = await Job.create({
        employer: employerId,
        title: 'Reliability Inspection Shift',
        description: 'Check that employerReliability is populated in job detail',
        category: 'Event assistance',
        openings: 1,
        locationName: 'Test Hall',
        workDate: shiftDate,
        startTime: '10:00',
        endTime: '18:00',
        totalHours: 8,
        grossPay: 25
      });

      const res = await request(app).get(`/api/jobs/${testJob._id}`);
      expect(res.status).toBe(200);
      expect(res.body.job.employerReliability).toBeDefined();
      expect(res.body.job.employerReliability.metrics).toBeDefined();
      expect(res.body.job.employerReliability.explanations).toBeDefined();
    });
  });
});
