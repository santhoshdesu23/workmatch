import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { signToken } from '../src/config/jwt.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Assignment } from '../src/models/Assignment.js';
import { PaymentRecord } from '../src/models/PaymentRecord.js';
import { ROLES, PAYMENT_STATUSES } from '../src/config/constants.js';
import { detectMagicBytes } from '../src/services/gridfsService.js';

describe('WorkMatch Payment Proof & MongoDB GridFS Evidence System Suite', () => {
  let employerToken;
  let employerUser;
  let employer2Token;
  let employer2User;
  let workerToken;
  let workerUser;
  let adminToken;
  let adminUser;
  let testPaymentId;
  let uploadedFileId;

  // Genuine file mock buffers with authentic magic numbers
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const genuinePngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);

  // JPEG: FF D8 FF
  const genuineJpgBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0xFF, 0xD9
  ]);

  // PDF: 25 50 44 46 (%PDF-1.4)
  const genuinePdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
  );

  // Fake executable file disguised with .png extension
  const fakeMaliciousBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00FakePEHeaderExecutingScripts');

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // 1. Setup Employer 1
    employerUser = await User.create({
      name: 'Radha Krishna Caterers',
      email: `employer.proof1.${Date.now()}@workmatch.local`,
      passwordHash: 'dummy_hash',
      role: ROLES.EMPLOYER,
      roles: [ROLES.EMPLOYER],
      activeRole: ROLES.EMPLOYER,
      emailVerified: true
    });
    employerToken = signToken({ id: employerUser._id, role: ROLES.EMPLOYER, roles: [ROLES.EMPLOYER] });

    // 2. Setup Employer 2 (for IDOR attack testing)
    employer2User = await User.create({
      name: 'Unrelated Third-Party Employer',
      email: `employer.proof2.${Date.now()}@workmatch.local`,
      passwordHash: 'dummy_hash',
      role: ROLES.EMPLOYER,
      roles: [ROLES.EMPLOYER],
      activeRole: ROLES.EMPLOYER,
      emailVerified: true
    });
    employer2Token = signToken({ id: employer2User._id, role: ROLES.EMPLOYER, roles: [ROLES.EMPLOYER] });

    // 3. Setup Worker
    workerUser = await User.create({
      name: 'Sameer Shinde',
      email: `worker.proof.${Date.now()}@workmatch.local`,
      passwordHash: 'dummy_hash',
      role: ROLES.WORKER,
      roles: [ROLES.WORKER],
      activeRole: ROLES.WORKER,
      emailVerified: true
    });
    workerToken = signToken({ id: workerUser._id, role: ROLES.WORKER, roles: [ROLES.WORKER] });

    // 4. Setup Admin
    adminUser = await User.create({
      name: 'System Admin Inspector',
      email: `admin.proof.${Date.now()}@workmatch.local`,
      passwordHash: 'dummy_hash',
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      activeRole: ROLES.ADMIN,
      emailVerified: true
    });
    adminToken = signToken({ id: adminUser._id, role: ROLES.ADMIN, roles: [ROLES.ADMIN] });

    // 5. Create Test Job, Assignment, and Payment Record
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testJob = await Job.create({
      employer: employerUser._id,
      title: 'Grand Wedding Buffet Server',
      description: 'Serve guests and clear tables at evening reception.',
      category: 'Wedding and catering support',
      locationName: 'Atigre, Kolhapur',
      workDate: tomorrow,
      workEndDate: tomorrow,
      startTime: '16:00',
      endTime: '23:00',
      totalHours: 7,
      grossPay: 800,
      payBasis: 'shift',
      openings: 2,
      status: 'OPEN'
    });

    const testAssignment = await Assignment.create({
      job: testJob._id,
      worker: workerUser._id,
      employer: employerUser._id,
      application: new mongoose.Types.ObjectId(),
      agreedSchedule: {
        workDate: tomorrow,
        workEndDate: tomorrow,
        startTime: '16:00',
        endTime: '23:00',
        totalHours: 7
      },
      agreedPayment: {
        grossAmount: 800,
        amount: 800,
        currency: 'INR',
        basis: 'shift'
      },
      status: 'COMPLETED'
    });

    const testPayment = await PaymentRecord.create({
      assignment: testAssignment._id,
      job: testJob._id,
      worker: workerUser._id,
      employer: employerUser._id,
      amount: 800,
      currency: 'INR',
      basis: 'shift',
      status: PAYMENT_STATUSES.DUE,
      paymentMethod: 'UPI'
    });

    testPaymentId = testPayment._id.toString();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Binary Signature & Magic Byte Validation', () => {
    it('detects genuine PNG magic bytes correctly', () => {
      const detected = detectMagicBytes(genuinePngBuffer);
      expect(detected).not.toBeNull();
      expect(detected?.ext).toBe('png');
      expect(detected?.mimeType).toBe('image/png');
    });

    it('detects genuine JPEG magic bytes correctly', () => {
      const detected = detectMagicBytes(genuineJpgBuffer);
      expect(detected).not.toBeNull();
      expect(detected?.ext).toBe('jpg');
      expect(detected?.mimeType).toBe('image/jpeg');
    });

    it('detects genuine PDF magic bytes correctly', () => {
      const detected = detectMagicBytes(genuinePdfBuffer);
      expect(detected).not.toBeNull();
      expect(detected?.ext).toBe('pdf');
      expect(detected?.mimeType).toBe('application/pdf');
    });

    it('rejects files with spoofed extensions that do not match permitted binary magic bytes', () => {
      const detected = detectMagicBytes(fakeMaliciousBuffer);
      expect(detected).toBeNull();
    });
  });

  describe('2. Dedicated Payment Proof Upload (GridFS)', () => {
    it('allows an employer to upload a genuine payment screenshot (HTTP 200)', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', genuinePngBuffer, 'upi_transfer_receipt.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.proofs).toBeDefined();
      expect(res.body.proofs.length).toBe(1);
      expect(res.body.proofs[0].fileId).toBeDefined();
      expect(res.body.proofs[0].originalName).toBe('upi_transfer_receipt.png');
      expect(res.body.proofs[0].mimeType).toBe('image/png');

      uploadedFileId = res.body.proofs[0].fileId;
    });

    it('rejects duplicate file upload with the same name and size (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', genuinePngBuffer, 'upi_transfer_receipt.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DUPLICATE_FILE');
    });

    it('rejects uploading a malicious file spoofed as PNG (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', fakeMaliciousBuffer, 'malicious_script.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid file type/i);
    });

    it('allows uploading a second PDF proof file up to 3 total (HTTP 200)', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', genuinePdfBuffer, 'bank_statement_voucher.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.proofs.length).toBe(2);
    });

    it('enforces maximum 3 files per payment record limit (HTTP 400)', async () => {
      // Third file
      await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', genuineJpgBuffer, 'third_photo.jpg');

      // Fourth file attempt should be blocked
      const fourthBuffer = Buffer.concat([genuineJpgBuffer, Buffer.from('extra_bytes_diff')]);
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/proofs`)
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('proofs', fourthBuffer, 'fourth_overflow.jpg');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TOO_MANY_FILES');
    });
  });

  describe('3. Multi-Tenant Authorization & Evidence Streaming (IDOR Prevention)', () => {
    it('allows the paying Employer to stream/preview the payment proof (HTTP 200)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-disposition']).toMatch(/inline/i);
    });

    it('allows the receiving Worker to stream/view the payment proof in their history (HTTP 200)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('allows a Platform Administrator to stream/inspect payment evidence (HTTP 200)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('strictly denies an unrelated Employer from accessing another employer’s payment proof (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${employer2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/access denied/i);
    });

    it('strictly denies unauthenticated requests from accessing payment proof (HTTP 401)', async () => {
      const res = await request(app).get(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('4. Business Logic Validation on Record Payment Status', () => {
    it('rejects marking payment as PAID via UPI without transaction reference (HTTP 400)', async () => {
      const res = await request(app)
        .patch(`/api/payments/${testPaymentId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: PAYMENT_STATUSES.PAID,
          paymentMethod: 'UPI',
          providerReference: '', // Missing
          confirmedDisbursed: true
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TRANSACTION_REF_REQUIRED');
    });

    it('rejects marking payment as PAID without confirming disbursement (HTTP 400)', async () => {
      const res = await request(app)
        .patch(`/api/payments/${testPaymentId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: PAYMENT_STATUSES.PAID,
          paymentMethod: 'UPI',
          providerReference: 'UPI-UTR-9823412',
          confirmedDisbursed: false // Unconfirmed
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('successfully marks payment as PAID when valid UTR, proof, and confirmation are provided (HTTP 200)', async () => {
      const res = await request(app)
        .patch(`/api/payments/${testPaymentId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          status: PAYMENT_STATUSES.PAID,
          paymentMethod: 'UPI',
          providerReference: 'UPI-UTR-9823412',
          note: 'Sent via PhonePe to worker mobile number.',
          confirmedDisbursed: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payment.status).toBe(PAYMENT_STATUSES.PAID);
      expect(res.body.payment.providerReference).toBe('UPI-UTR-9823412');
    });
  });

  describe('5. Evidence Deletion Safeguards', () => {
    it('prevents a worker from deleting an employer’s payment proof (HTTP 403)', async () => {
      const res = await request(app)
        .delete(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows the employer to delete a proof attachment and cleans up GridFS (HTTP 200)', async () => {
      const res = await request(app)
        .delete(`/api/payments/${testPaymentId}/proofs/${uploadedFileId}`)
        .set('Authorization', `Bearer ${employerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.proofs.some((p) => p.fileId.toString() === uploadedFileId.toString())).toBe(false);
    });
  });

  describe('6. Admin Dashboard Payment & Evidence Inspection', () => {
    it('allows an administrator to query platform payments with proof filter (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/admin/payments?hasProof=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payments).toBeDefined();
      expect(Array.isArray(res.body.payments)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });
});
