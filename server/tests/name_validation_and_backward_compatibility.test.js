import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { WorkerProfile } from '../src/models/WorkerProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { validateNameField, MAX_NAME_LENGTH } from '../src/utils/nameValidator.js';

describe('WorkMatch Name Validation & Backward Compatibility Test Suite', () => {
  const ts = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Unit Validation Rule Tests', () => {
    it('validates normal first and last names', () => {
      expect(validateNameField('Alex', 'First name')).toBeNull();
      expect(validateNameField('Rivera', 'Last name')).toBeNull();
    });

    it('rejects empty or whitespace-only names', () => {
      expect(validateNameField('', 'First name')).toBe('First name is required.');
      expect(validateNameField('   ', 'First name')).toBe('First name is required.');
      expect(validateNameField(null, 'Last name')).toBe('Last name is required.');
      expect(validateNameField(undefined, 'Last name')).toBe('Last name is required.');
    });

    it('accepts names with exactly 30 characters', () => {
      const thirtyChars = 'A'.repeat(30);
      expect(thirtyChars.length).toBe(30);
      expect(validateNameField(thirtyChars, 'First name')).toBeNull();
    });

    it('rejects names with more than 30 characters', () => {
      const thirtyOneChars = 'A'.repeat(31);
      expect(thirtyOneChars.length).toBe(31);
      expect(validateNameField(thirtyOneChars, 'First name')).toBe(
        'First name cannot exceed 30 characters.'
      );
    });

    it('allows leading/trailing whitespace if trimmed length is valid', () => {
      expect(validateNameField('   Alex   ', 'First name')).toBeNull();
      const paddedThirty = '   ' + 'A'.repeat(30) + '   ';
      expect(validateNameField(paddedThirty, 'First name')).toBeNull();
    });

    it('preserves valid legitimate characters: hyphens, apostrophes, spaces, periods, and unicode accents', () => {
      expect(validateNameField('Mary-Jane', 'First name')).toBeNull();
      expect(validateNameField("O'Connor", 'Last name')).toBeNull();
      expect(validateNameField("D'Angelo", 'Last name')).toBeNull();
      expect(validateNameField('De La Rosa', 'Last name')).toBeNull();
      expect(validateNameField('St. John', 'Last name')).toBeNull();
      expect(validateNameField('Renée', 'First name')).toBeNull();
      expect(validateNameField('Müller', 'Last name')).toBeNull();
      expect(validateNameField('José', 'First name')).toBeNull();
    });

    it('rejects invalid symbols, script tags, numbers, and control characters', () => {
      expect(validateNameField('<script>', 'First name')).toContain('can only contain');
      expect(validateNameField('User123', 'First name')).toContain('can only contain');
      expect(validateNameField('Alex$#@', 'First name')).toContain('can only contain');
    });
  });

  describe('2. Registration with Separate First and Last Name', () => {
    it('successfully registers a worker with valid firstName and lastName', async () => {
      const email = `val.worker.${ts}.1@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Elena',
        lastName: 'Rostova',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.firstName).toBe('Elena');
      expect(res.body.user.lastName).toBe('Rostova');
      expect(res.body.user.name).toBe('Elena Rostova');

      // Verify in MongoDB
      const saved = await User.findById(res.body.user.id);
      expect(saved.firstName).toBe('Elena');
      expect(saved.lastName).toBe('Rostova');
      expect(saved.name).toBe('Elena Rostova');
    });

    it('successfully registers an employer with valid representative names', async () => {
      const email = `val.employer.${ts}.1@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Marcus',
        lastName: 'Vance',
        businessName: 'Vance Logistics Inc',
        email,
        password: 'Password123!',
        role: 'employer'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.firstName).toBe('Marcus');
      expect(res.body.user.lastName).toBe('Vance');
      expect(res.body.user.name).toBe('Marcus Vance');
    });

    it('trims leading and trailing whitespace on registration', async () => {
      const email = `val.trim.${ts}@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: '   Sofia   ',
        lastName: '   Martinez   ',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.firstName).toBe('Sofia');
      expect(res.body.user.lastName).toBe('Martinez');
      expect(res.body.user.name).toBe('Sofia Martinez');
    });

    it('accepts exactly 30 characters for both fields on registration', async () => {
      const thirtyFirst = 'A'.repeat(30);
      const thirtyLast = 'B'.repeat(30);
      const email = `val.exact30.${ts}@example.com`;

      const res = await request(app).post('/api/auth/register').send({
        firstName: thirtyFirst,
        lastName: thirtyLast,
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.firstName).toBe(thirtyFirst);
      expect(res.body.user.lastName).toBe(thirtyLast);
    });

    it('handles legitimate special characters in names (hyphens, apostrophes, spaces)', async () => {
      const email = `val.special.${ts}@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Jean-Luc',
        lastName: "O'Brien-Smith",
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.firstName).toBe('Jean-Luc');
      expect(res.body.user.lastName).toBe("O'Brien-Smith");
      expect(res.body.user.name).toBe("Jean-Luc O'Brien-Smith");
    });
  });

  describe('3. Registration Backend Validation Bypass Attempts', () => {
    it('rejects registration when firstName exceeds 30 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'A'.repeat(31),
        lastName: 'Smith',
        email: `bypass.longfirst.${ts}@example.com`,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('First name cannot exceed 30 characters');
    });

    it('rejects registration when lastName exceeds 30 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Alice',
        lastName: 'B'.repeat(31),
        email: `bypass.longlast.${ts}@example.com`,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Last name cannot exceed 30 characters');
    });

    it('rejects registration when firstName is empty or missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: '',
        lastName: 'Smith',
        email: `bypass.emptyfirst.${ts}@example.com`,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('required');
    });

    it('rejects registration when lastName is empty or missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Alice',
        lastName: '',
        email: `bypass.emptylast.${ts}@example.com`,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('required');
    });

    it('rejects registration when name contains disallowed characters / scripts', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: '<script>alert(1)</script>',
        lastName: 'Smith',
        email: `bypass.xss.${ts}@example.com`,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('can only contain letters');
    });
  });

  describe('4. Backward Compatibility with Old fullName Format', () => {
    it('legacy registration using single name field continues to succeed', async () => {
      const email = `legacy.reg.${ts}@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        name: 'Legacy Alexander Hamilton',
        email,
        password: 'Password123!',
        role: 'worker'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('Legacy Alexander Hamilton');
      expect(res.body.user.firstName).toBe('Legacy');
      expect(res.body.user.lastName).toBe('Alexander Hamilton');
    });

    it('existing account created before migration (only fullName in database) logs in seamlessly', async () => {
      const email = `legacy.account.${ts}@example.com`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Password123!', salt);

      // Create directly in Mongo without firstName/lastName to simulate legacy database record
      await User.collection.insertOne({
        name: 'Arthur Conan Doyle',
        email,
        passwordHash,
        role: 'worker',
        accountStatus: 'active',
        emailVerified: true,
        verificationStatus: 'unverified',
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Login attempt
      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'Password123!'
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.user.name).toBe('Arthur Conan Doyle');
      // Verify firstName and lastName are derived automatically
      expect(loginRes.body.user.firstName).toBe('Arthur');
      expect(loginRes.body.user.lastName).toBe('Conan Doyle');

      // GET /api/auth/me should also return both
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.name).toBe('Arthur Conan Doyle');
      expect(meRes.body.user.firstName).toBe('Arthur');
      expect(meRes.body.user.lastName).toBe('Conan Doyle');
    });
  });

  describe('5. Profile Updates: Worker Profile', () => {
    let workerToken;
    let workerUserId;

    beforeAll(async () => {
      const email = `worker.profile.update.${ts}@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Taylor',
        lastName: 'Swift',
        email,
        password: 'Password123!',
        role: 'worker'
      });
      workerToken = res.body.token;
      workerUserId = res.body.user.id;
    });

    it('updates worker firstName and lastName and synchronizes fullName', async () => {
      const res = await request(app)
        .patch('/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          firstName: 'Taylor-Anne',
          lastName: "O'Swift",
          bio: 'Updated worker biography'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check updated User record
      const updatedUser = await User.findById(workerUserId);
      expect(updatedUser.firstName).toBe('Taylor-Anne');
      expect(updatedUser.lastName).toBe("O'Swift");
      expect(updatedUser.name).toBe("Taylor-Anne O'Swift");

      // Verify GET /api/workers/me returns the updated fields
      const getRes = await request(app)
        .get('/workers/me')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.user.firstName).toBe('Taylor-Anne');
      expect(getRes.body.user.lastName).toBe("O'Swift");
      expect(getRes.body.user.name).toBe("Taylor-Anne O'Swift");
    });

    it('never overwrites existing user name with empty or whitespace values', async () => {
      const res = await request(app)
        .patch('/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          firstName: '   ',
          bio: 'Hacker trying to wipe name'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('required');

      // Verify name was preserved
      const user = await User.findById(workerUserId);
      expect(user.firstName).toBe('Taylor-Anne');
      expect(user.lastName).toBe("O'Swift");
    });

    it('rejects worker profile update exceeding 30 characters', async () => {
      const res = await request(app)
        .patch('/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          firstName: 'C'.repeat(31)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('First name cannot exceed 30 characters');
    });
  });

  describe('6. Profile Updates: Employer Profile', () => {
    let employerToken;
    let employerUserId;

    beforeAll(async () => {
      const email = `employer.profile.update.${ts}@example.com`;
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Diana',
        lastName: 'Prince',
        businessName: 'Themyscira Staffing Co',
        email,
        password: 'Password123!',
        role: 'employer'
      });
      employerToken = res.body.token;
      employerUserId = res.body.user.id;
    });

    it('updates employer contact representative name with valid 30-char fields', async () => {
      const res = await request(app)
        .patch('/employers/me')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          firstName: 'Diana-Marie',
          lastName: 'Prince-Wayne',
          description: 'Premier staffing agency'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedUser = await User.findById(employerUserId);
      expect(updatedUser.firstName).toBe('Diana-Marie');
      expect(updatedUser.lastName).toBe('Prince-Wayne');
      expect(updatedUser.name).toBe('Diana-Marie Prince-Wayne');

      const getRes = await request(app)
        .get('/employers/me')
        .set('Authorization', `Bearer ${employerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.user.firstName).toBe('Diana-Marie');
      expect(getRes.body.user.lastName).toBe('Prince-Wayne');
    });

    it('never overwrites existing employer name with empty values', async () => {
      const res = await request(app)
        .patch('/employers/me')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          lastName: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const user = await User.findById(employerUserId);
      expect(user.lastName).toBe('Prince-Wayne');
    });

    it('rejects employer representative name exceeding 30 characters', async () => {
      const res = await request(app)
        .patch('/employers/me')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          lastName: 'X'.repeat(31)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Last name cannot exceed 30 characters');
    });
  });
});
