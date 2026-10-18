import mongoose from 'mongoose';
import { JOB_STATUSES, JOB_CATEGORIES, PAYMENT_BASES } from '../config/constants.js';

const jobSchema = new mongoose.Schema(
  {
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: 3000
    },
    category: {
      type: String,
      required: true,
      enum: JOB_CATEGORIES,
      index: true
    },
    requiredSkills: {
      type: [String],
      default: [],
      index: true
    },
    openings: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    filledCount: {
      type: Number,
      default: 0,
      min: 0
    },
    locationName: {
      type: String,
      required: [true, 'Location address or description is required']
    },
    locality: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: '',
      index: true
    },
    district: {
      type: String,
      trim: true,
      default: '',
      index: true
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0]
      }
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true
    },
    seedId: {
      type: String,
      index: true,
      sparse: true
    },
    workDate: {
      type: Date,
      required: true,
      index: true
    },
    startTime: {
      type: String,
      required: true // e.g. "09:00"
    },
    endTime: {
      type: String,
      required: true // e.g. "17:00"
    },
    breakDurationMinutes: {
      type: Number,
      default: 30
    },
    totalHours: {
      type: Number,
      required: true,
      min: 0.5
    },
    grossPay: {
      type: Number,
      required: true,
      min: 1
    },
    payBasis: {
      type: String,
      enum: Object.values(PAYMENT_BASES),
      default: PAYMENT_BASES.HOURLY
    },
    currency: {
      type: String,
      default: 'USD'
    },
    paymentMethod: {
      type: String,
      default: 'Bank Transfer / Platform Recorded'
    },
    paymentTiming: {
      type: String,
      default: 'Same Day / Within 24 hours of completion'
    },
    experienceRequirement: {
      type: String,
      default: 'No prior experience required'
    },
    dressCode: {
      type: String,
      default: 'Casual / comfortable clothing'
    },
    physicalRequirements: {
      type: String,
      default: 'Standard physical mobility for role'
    },
    ageRestriction: {
      type: String,
      default: '18+'
    },
    applicationDeadline: {
      type: Date,
      required: true,
      default: function () {
        return this.workDate || new Date();
      }
    },
    cancellationPolicy: {
      type: String,
      default: 'Notice must be provided at least 12 hours prior to shift commencement'
    },
    status: {
      type: String,
      enum: Object.values(JOB_STATUSES),
      default: JOB_STATUSES.OPEN,
      index: true
    },
    viewsCount: {
      type: Number,
      default: 0
    },
    applicationsCount: {
      type: Number,
      default: 0
    },
    detailsConfirmed: {
      type: Boolean,
      default: false,
      index: true
    },
    detailsConfirmedAt: {
      type: Date
    },
    detailsConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

jobSchema.index({ location: '2dsphere' });
jobSchema.index({ status: 1, workDate: 1, category: 1 });
jobSchema.index({ city: 1, district: 1 });

export const Job = mongoose.model('Job', jobSchema);
