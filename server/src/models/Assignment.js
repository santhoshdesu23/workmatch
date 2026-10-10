import mongoose from 'mongoose';
import { ASSIGNMENT_STATUSES } from '../config/constants.js';

const assignmentSchema = new mongoose.Schema(
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
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true
    },
    agreedSchedule: {
      workDate: { type: Date, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      totalHours: { type: Number, required: true }
    },
    agreedPayment: {
      grossAmount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      basis: { type: String, default: 'hourly' }
    },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUSES),
      default: ASSIGNMENT_STATUSES.CONFIRMED,
      index: true
    },
    attendance: {
      checkedInAt: { type: Date },
      checkedOutAt: { type: Date },
      notes: { type: String, default: '' }
    },
    completionConfirmations: {
      workerConfirmed: { type: Boolean, default: false },
      workerConfirmedAt: { type: Date },
      employerConfirmed: { type: Boolean, default: false },
      employerConfirmedAt: { type: Date }
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

assignmentSchema.index({ job: 1, worker: 1 });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
