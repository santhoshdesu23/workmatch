import multer from 'multer';
import { MAX_FILE_SIZE_BYTES } from '../services/gridfsService.js';

// Use memory storage to allow magic-byte binary validation before persisting to GridFS
const storage = multer.memoryStorage();

export const uploadPaymentProofs = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 5 MB per file
    files: 3 // Maximum 3 files per request
  },
  fileFilter: (req, file, cb) => {
    // Initial mimeType filter
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload PNG, JPG, JPEG, or PDF documents.'));
    }
  }
});

/**
 * Express middleware wrapper to catch Multer errors and return clean JSON
 */
export const handlePaymentProofUpload = (fieldName = 'proofs', maxCount = 3) => {
  const upload = uploadPaymentProofs.array(fieldName, maxCount);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            code: 'FILE_TOO_LARGE',
            message: 'One or more files exceed the 5 MB maximum size limit.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            code: 'TOO_MANY_FILES',
            message: 'You can upload a maximum of 3 payment proof files per payment.'
          });
        }
        return res.status(400).json({
          success: false,
          code: 'UPLOAD_ERROR',
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_FILE_TYPE',
          message: err.message
        });
      }
      next();
    });
  };
};
