import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { signToken } from '../src/config/jwt.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { ROLES } from '../src/config/constants.js';

const TEST_PASSWORD = 'DualRolePass123!';
let replicaSet;
let originalMongoUri;

async function createTestWorker(suffix = `${Date.now()}-${Math.random()}`) {
  const user = await User.create({
    name: `Worker User ${suffix}`,
    firstName: 'Worker',
    lastName: 'User',
    email: `worker.${suffix}@test.local`,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 8),
    role: ROLES.WORKER,
    roles: [ROLES.WORKER],
    activeRole: ROLES.WORKER,
    emailVerified: true
  });

  const workerProfile = await WorkerProfile.create({
    user: user._id,
    skills: ['Event Assistance', 'Customer Service'],
    preferredCategories: ['Event assistance'],
    travelRadiusKm: 25,
    completedJobsCount: 3
  });

  const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });
  return { user, workerProfile, token };
}

async function createTestEmployer(suffix = `${Date.now()}-${Math.random()}`) {
  const user = await User.create({
    name: `Employer User ${suffix}`,
    firstName: 'Employer',
    lastName: 'User',
    email: `employer.${suffix}@test.local`,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 8),
    role: ROLES.EMPLOYER,
    roles: [ROLES.EMPLOYER],
    activeRole: ROLES.EMPLOYER,
    emailVerified: true
  });

  const employerProfile = await EmployerProfile.create({
    user: user._id,
    businessName: `Test Corp ${suffix}`,
    businessCategory: 'Logistics'
  });

  const token = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });
  return { user, employerProfile, token };
}

describe('Permanent Dual-Role Account & Workspace Switching Test Suite', () => {
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

  describe('1. Worker enabling Employer workspace', () => {
    it('allows an existing worker to activate employer workspace with business details', async () => {
      const { user, workerProfile, token } = await createTestWorker();

      const res = await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessName: 'Desu Logistics & Co',
          businessCategory: 'Logistics',
          businessAddress: '42 Main St'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();

      // Check roles
      expect(res.body.user.roles).toContain(ROLES.WORKER);
      expect(res.body.user.roles).toContain(ROLES.EMPLOYER);
      expect(res.body.user.activeRole).toBe(ROLES.EMPLOYER);

      // Verify DB User record
      const dbUser = await User.findById(user._id);
      expect(dbUser.roles).toEqual(expect.arrayContaining([ROLES.WORKER, ROLES.EMPLOYER]));
      expect(dbUser.activeRole).toBe(ROLES.EMPLOYER);

      // Verify EmployerProfile was created
      const dbEmpProfile = await EmployerProfile.findOne({ user: user._id });
      expect(dbEmpProfile).not.toBeNull();
      expect(dbEmpProfile.businessName).toBe('Desu Logistics & Co');

      // Verify WorkerProfile was preserved and unmodified
      const dbWorkerProfile = await WorkerProfile.findById(workerProfile._id);
      expect(dbWorkerProfile).not.toBeNull();
      expect(dbWorkerProfile.skills).toEqual(expect.arrayContaining(['Event Assistance']));
      expect(dbWorkerProfile.completedJobsCount).toBe(3);
    });

    it('validates businessName when enabling employer role', async () => {
      const { token } = await createTestWorker();

      const res = await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/business.*name/i);
    });

    it('is idempotent when activating employer workspace multiple times', async () => {
      const { user, token } = await createTestWorker();

      // First call
      await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 'Initial Brand' });

      // Second call with different or same info
      const res2 = await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 'Initial Brand Updated' });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      // Verify exactly ONE employer profile exists for this user
      const empProfiles = await EmployerProfile.find({ user: user._id });
      expect(empProfiles.length).toBe(1);

      // Verify roles array has no duplicates
      const dbUser = await User.findById(user._id);
      const employerOccurrences = dbUser.roles.filter((r) => r === ROLES.EMPLOYER).length;
      expect(employerOccurrences).toBe(1);
    });
  });

  describe('2. Employer enabling Worker workspace', () => {
    it('allows an existing employer to activate worker workspace', async () => {
      const { user, employerProfile, token } = await createTestEmployer();

      const res = await request(app)
        .post('/api/auth/enable-worker')
        .set('Authorization', `Bearer ${token}`)
        .send({ skills: ['Packaging', 'Delivery'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.roles).toContain(ROLES.WORKER);
      expect(res.body.user.roles).toContain(ROLES.EMPLOYER);
      expect(res.body.user.activeRole).toBe(ROLES.WORKER);

      // Verify WorkerProfile exists
      const dbWorkerProfile = await WorkerProfile.findOne({ user: user._id });
      expect(dbWorkerProfile).not.toBeNull();
      expect(dbWorkerProfile.skills).toEqual(expect.arrayContaining(['Packaging']));

      // Verify EmployerProfile is still intact
      const dbEmpProfile = await EmployerProfile.findById(employerProfile._id);
      expect(dbEmpProfile).not.toBeNull();
    });
  });

  describe('3. Seamless Workspace Switching (activeRole)', () => {
    it('allows dual-role user to switch activeRole to worker and employer', async () => {
      const { user, token: workerToken } = await createTestWorker();

      // Enable employer
      const enableRes = await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ businessName: 'Switch Test Corp' });

      const empToken = enableRes.body.token;

      // Switch back to worker workspace
      const switchWorkerRes = await request(app)
        .patch('/api/auth/active-role')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ role: ROLES.WORKER });

      expect(switchWorkerRes.status).toBe(200);
      expect(switchWorkerRes.body.success).toBe(true);
      expect(switchWorkerRes.body.user.activeRole).toBe(ROLES.WORKER);
      expect(switchWorkerRes.body.token).toBeDefined();

      const switchedWorkerToken = switchWorkerRes.body.token;

      // Verify /auth/me reflects activeRole worker
      const meRes1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${switchedWorkerToken}`);
      expect(meRes1.status).toBe(200);
      expect(meRes1.body.user.activeRole).toBe(ROLES.WORKER);
      expect(meRes1.body.user.roles).toEqual(expect.arrayContaining([ROLES.WORKER, ROLES.EMPLOYER]));
      expect(meRes1.body.user.workerProfile).toBeDefined();
      expect(meRes1.body.user.employerProfile).toBeDefined();

      // Switch to employer workspace
      const switchEmpRes = await request(app)
        .patch('/api/auth/active-role')
        .set('Authorization', `Bearer ${switchedWorkerToken}`)
        .send({ role: ROLES.EMPLOYER });

      expect(switchEmpRes.status).toBe(200);
      expect(switchEmpRes.body.user.activeRole).toBe(ROLES.EMPLOYER);
    });

    it('rejects switching to a role that has not been enabled on the user account', async () => {
      const { token } = await createTestWorker(); // worker only

      const res = await request(app)
        .patch('/api/auth/active-role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: ROLES.EMPLOYER });

      expect([400, 403]).toContain(res.status);
      expect(res.body.message).toMatch(/not enabled/i);
    });

    it('prevents any non-admin user from switching or escalating to admin role', async () => {
      const { token } = await createTestWorker();

      const res = await request(app)
        .patch('/api/auth/active-role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: ROLES.ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/administrator workspace/i);
    });
  });

  describe('4. Middleware Authorization with Dual Roles', () => {
    it('allows a dual-role user to access both worker and employer protected routes', async () => {
      const { user, token } = await createTestWorker();

      // Enable employer
      const enableRes = await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 'Route Access Corp' });

      const dualToken = enableRes.body.token;

      // Access employer endpoint (e.g. GET /api/employers/me)
      const empRes = await request(app)
        .get('/api/employers/me')
        .set('Authorization', `Bearer ${dualToken}`);
      expect(empRes.status).toBe(200);
      expect(empRes.body.success).toBe(true);

      // Access worker endpoint (e.g. GET /api/workers/me)
      const workerRes = await request(app)
        .get('/api/workers/me')
        .set('Authorization', `Bearer ${dualToken}`);
      expect(workerRes.status).toBe(200);
      expect(workerRes.body.success).toBe(true);
    });
  });

  describe('5. Backward Compatibility & Login Persistence', () => {
    it('initializes roles and activeRole for legacy user records without them', async () => {
      // Direct raw insertion simulating legacy record
      const rawUser = await User.collection.insertOne({
        name: 'Legacy Worker',
        email: `legacy.${Date.now()}@test.local`,
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 8),
        role: ROLES.WORKER,
        emailVerified: true
      });

      const loadedUser = await User.findById(rawUser.insertedId);
      expect(loadedUser.roles).toEqual([ROLES.WORKER]);
      expect(loadedUser.activeRole).toBe(ROLES.WORKER);
    });

    it('login returns roles, activeRole, and populated profile objects', async () => {
      const { user } = await createTestWorker();

      // Enable employer
      const workerToken = signToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 });
      await request(app)
        .post('/api/auth/enable-employer')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ businessName: 'Login Test Co' });

      // Log in anew
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: TEST_PASSWORD
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.user.roles).toEqual(expect.arrayContaining([ROLES.WORKER, ROLES.EMPLOYER]));
      expect(loginRes.body.user.workerProfile).toBeDefined();
      expect(loginRes.body.user.employerProfile).toBeDefined();
    });
  });
});
