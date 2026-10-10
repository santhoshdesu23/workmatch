import mongoose from 'mongoose';
import { PAYMENT_STATUSES } from '../config/constants.js';

const paymentRecordSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      unique: true,
      index: true
    },
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
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    basis: {
      type: String,
      default: 'hourly'
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.NOT_DUE,
      index: true
    },
    expectedDate: {
      type: Date
    },
    paymentMethod: {
      type: String,
      default: 'Recorded by Employer'
    },
    providerReference: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    history: [
      {
        status: { type: String, required: true },
        note: { type: String, default: '' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const PaymentRecord = mongoose.model('PaymentRecord', paymentRecordSchema);
