import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { signToken } from '../src/config/jwt.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assignment } from '../src/models/Assignment.js';
import { Notification } from '../src/models/Notification.js';
import { VerificationRequest } from '../src/models/VerificationRequest.js';
import { JOB_STATUSES, ASSIGNMENT_STATUSES } from '../src/config/constants.js';

const TEST_PASSWORD = 'AccountDelete123!';
let replicaSet;
let originalMongoUri;

async function createAccount(role, suffix = `${Date.now()}-${Math.random()}`) {
  const user = await User.create({
    name: `${role} account`,
    email: `${role}.${suffix}@test.local`,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 8),
    role,
    emailVerified: true
  });
  const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });
  return { user, token };
}

async function createJob(employerId, overrides = {}) {
  return Job.create({
    employer: employerId,
    title: 'Account deletion test shift',
    description: 'A test shift used to verify account deletion behavior.',
    category: 'Event assistance',
    openings: 1,
    locationName: 'Test venue',
    workDate: new Date(Date.now() + 86400000),
    applicationDeadline: new Date(Date.now() + 86400000),
    startTime: '09:00',
    endTime: '17:00',
    totalHours: 8,
    grossPay: 100,
    status: JOB_STATUSES.OPEN,
    ...overrides
  });
}

describe('Account deletion', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    originalMongoUri = process.env.MONGODB_URI;
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replicaSet.getUri('workmatch_account_deletion_test');
    await connectDB();
  }, 60000);

  afterAll(async () => {
    await disconnectDB();
    if (replicaSet) await replicaSet.stop();
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  });

  it('requires authentication and rejects invalid confirmation or password', async () => {
    await request(app).delete('/api/auth/account').send({ password: TEST_PASSWORD, confirmation: 'DELETE' }).expect(401);

    const { user, token } = await createAccount('worker');
    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'delete' })
      .expect(400);
    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPassword123!', confirmation: 'DELETE' })
      .expect(401);

    expect((await User.findById(user._id)).accountStatus).toBe('active');
  });

  it('deletes only the authenticated user, removes private data, retains history, and invalidates the session', async () => {
    const { user: worker, token } = await createAccount('worker');
    const { user: anotherUser } = await createAccount('worker');
    const { user: employer } = await createAccount('employer');
    await WorkerProfile.create({ user: worker._id, skills: ['Packing'] });
    await Notification.create({ recipient: worker._id, title: 'Private inbox item', message: 'Remove this item.' });
    await VerificationRequest.create({
      user: worker._id,
      verificationType: 'identity',
      submittedData: { documentType: 'ID', documentRef: 'private-test-reference' }
    });
    const job = await createJob(employer._id);
    const application = await Application.create({ job: job._id, worker: worker._id, message: 'Historical application' });

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'DELETE', userId: anotherUser._id });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const tombstone = await User.findById(worker._id);
    expect(tombstone.accountStatus).toBe('deleted');
    expect(tombstone.name).toBe('Deleted Account');
    expect(tombstone.email).not.toBe(worker.email);
    expect(await WorkerProfile.findOne({ user: worker._id })).toBeNull();
    expect(await Notification.countDocuments({ recipient: worker._id })).toBe(0);
    expect((await VerificationRequest.findOne({ user: worker._id })).submittedData).toBeUndefined();
    const retainedApplication = await Application.findById(application._id);
    expect(retainedApplication.worker.toString()).toBe(worker._id.toString());
    expect(retainedApplication.status).toBe('WITHDRAWN');
    expect((await User.findById(anotherUser._id)).accountStatus).toBe('active');
    expect(await Notification.exists({ recipient: employer._id, relatedResource: { resourceType: 'Job', resourceId: job._id } })).toBeTruthy();

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'DELETE' })
      .expect(401);
  });

  it('closes an employer’s unfinished listings and cancels pending applications', async () => {
    const { user: employer, token } = await createAccount('employer');
    const { user: worker } = await createAccount('worker');
    await EmployerProfile.create({ user: employer._id, businessName: 'Deletion Test Business' });
    const job = await createJob(employer._id);
    const application = await Application.create({ job: job._id, worker: worker._id, message: 'Interested' });

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'DELETE' });

    expect(response.status).toBe(200);
    expect((await Job.findById(job._id)).status).toBe(JOB_STATUSES.CANCELLED);
    expect((await Application.findById(application._id)).status).toBe('CANCELLED');
    expect(await EmployerProfile.findOne({ user: employer._id })).toBeNull();
    expect(await Notification.exists({ recipient: worker._id, relatedResource: { resourceType: 'Job', resourceId: job._id } })).toBeTruthy();
  });

  it('refuses deletion while a confirmed or in-progress assignment exists', async () => {
    const { user: employer } = await createAccount('employer');
    const { user: worker, token } = await createAccount('worker');
    const job = await createJob(employer._id, { filledCount: 1 });
    const application = await Application.create({ job: job._id, worker: worker._id, status: 'HIRED' });
    await Assignment.create({
      job: job._id,
      worker: worker._id,
      employer: employer._id,
      application: application._id,
      agreedSchedule: { workDate: job.workDate, startTime: job.startTime, endTime: job.endTime, totalHours: 8 },
      agreedPayment: { grossAmount: job.grossPay, currency: job.currency, basis: job.payBasis },
      status: ASSIGNMENT_STATUSES.CONFIRMED
    });

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'DELETE' });

    expect(response.status).toBe(409);
    expect((await User.findById(worker._id)).accountStatus).toBe('active');
  });

  it('does not report success or partially delete the account when a transactional write fails', async () => {
    const { user, token } = await createAccount('worker');
    await WorkerProfile.create({ user: user._id });
    const deleteProfile = vi.spyOn(WorkerProfile, 'deleteOne').mockRejectedValue(new Error('simulated database failure'));

    try {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: TEST_PASSWORD, confirmation: 'DELETE' });
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect((await User.findById(user._id)).accountStatus).toBe('active');
      expect(await WorkerProfile.exists({ user: user._id })).toBeTruthy();
    } finally {
      deleteProfile.mockRestore();
    }
  });
});