import mongoose from 'mongoose';
import crypto from 'crypto';
import { Readable } from 'stream';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PROOFS_PER_PAYMENT = 3;
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

/**
 * Validates actual file binary signature (magic bytes)
 * Ensures file contents match allowed types and prevents extension spoofing.
 */
export function detectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // PNG: 89 50 4E 47 (\x89PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { ext: 'png', mimeType: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { ext: 'jpg', mimeType: 'image/jpeg' };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { ext: 'pdf', mimeType: 'application/pdf' };
  }

  return null;
}

/**
 * Get the dedicated GridFS bucket for payment proofs.
 */
export function getPaymentProofsBucket() {
  if (!mongoose.connection.db) {
    throw new Error('Database connection is not open for GridFS bucket initialization.');
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'paymentProofs'
  });
}

/**
 * Store a payment proof file into MongoDB GridFS.
 */
export async function storePaymentProof({
  fileBuffer,
  originalName,
  declaredMimeType,
  uploadedBy,
  paymentId,
  jobId
}) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty or missing.');
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`);
  }

  // Detect signature from real binary bytes
  const detected = detectMagicBytes(fileBuffer);
  if (!detected) {
    throw new Error('Invalid file type. Only authentic PNG, JPG, JPEG, and PDF documents are permitted.');
  }

  // Generate safe storage filename using crypto token
  const safeRandomToken = crypto.randomBytes(12).toString('hex');
  const safeFileName = `proof_${paymentId}_${Date.now()}_${safeRandomToken}.${detected.ext}`;

  // Sanitize original filename (keep only base name, max 120 chars)
  const sanitizedOriginal = String(originalName || `proof.${detected.ext}`)
    .replace(/[^\w\d_.-]/g, '_')
    .slice(0, 120);

  const bucket = getPaymentProofsBucket();

  const metadata = {
    originalName: sanitizedOriginal,
    mimeType: detected.mimeType,
    size: fileBuffer.length,
    uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
    paymentId: new mongoose.Types.ObjectId(paymentId),
    jobId: jobId ? new mongoose.Types.ObjectId(jobId) : null,
    uploadTimestamp: new Date()
  };

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(safeFileName, {
      contentType: detected.mimeType,
      metadata
    });

    const fileId = uploadStream.id;

    const readable = new Readable();
    readable.push(fileBuffer);
    readable.push(null);

    uploadStream.on('error', (err) => {
      reject(new Error(`Failed to write payment proof into GridFS: ${err.message}`));
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId,
        originalName: sanitizedOriginal,
        fileName: safeFileName,
        mimeType: detected.mimeType,
        size: fileBuffer.length,
        uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
        uploadedAt: metadata.uploadTimestamp
      });
    });

    readable.pipe(uploadStream);
  });
}

/**
 * Retrieve a payment proof file stream from GridFS.
 */
export async function getPaymentProofStream(fileId) {
  const bucket = getPaymentProofsBucket();
  const objId = new mongoose.Types.ObjectId(fileId);

  const files = await bucket.find({ _id: objId }).toArray();
  if (!files || files.length === 0) {
    return null;
  }

  const fileDoc = files[0];
  const downloadStream = bucket.openDownloadStream(objId);

  return {
    fileDoc,
    downloadStream
  };
}

/**
 * Delete a payment proof file from GridFS.
 */
export async function deletePaymentProofFile(fileId) {
  try {
    const bucket = getPaymentProofsBucket();
    const objId = new mongoose.Types.ObjectId(fileId);
    await bucket.delete(objId);
    return true;
  } catch (err) {
    console.warn(`[GridFS] Error deleting file ${fileId}:`, err.message);
    return false;
  }
}
