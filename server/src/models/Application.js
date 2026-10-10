import mongoose from 'mongoose';
import { APPLICATION_STATUSES } from '../config/constants.js';

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUSES),
      default: APPLICATION_STATUSES.APPLIED,
      index: true
    },
    message: {
      type: String,
      default: '',
      maxlength: 1000
    },
    offerDetails: {
      offeredAt: { type: Date },
      note: { type: String, default: '' },
      expiresAt: { type: Date }
    },
    decisionHistory: [
      {
        status: { type: String, required: true },
        note: { type: String, default: '' },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Prevent duplicate applications by same worker for the same job
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
