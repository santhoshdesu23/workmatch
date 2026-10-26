import mongoose from 'mongoose';

const submittedDataSchema = new mongoose.Schema(
  {
    businessName: { type: String },
    registrationNumber: { type: String },
    documentType: { type: String },
    documentRef: { type: String }
  },
  { _id: false }
);

const verificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    verificationType: {
      type: String,
      enum: ['identity', 'business_license', 'tax_id', 'contact'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    submittedData: {
      type: submittedDataSchema,
      default: undefined
    },
    reviewNotes: {
      type: String,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);
