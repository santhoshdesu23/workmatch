import mongoose from 'mongoose';
import { ATTENDANCE_STATUSES, ATTENDANCE_METHODS } from '../config/constants.js';

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['CHECK_IN', 'MANUAL_PRESENT', 'MANUAL_ABSENT', 'CORRECTION'],
      required: true
    },
    previousStatus: {
      type: String,
      default: ATTENDANCE_STATUSES.PENDING
    },
    newStatus: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      default: ''
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required'],
      index: true
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Worker reference is required'],
      index: true
    },
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employer reference is required'],
      index: true
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required'],
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUSES),
      default: ATTENDANCE_STATUSES.PENDING,
      index: true
    },
    method: {
      type: String,
      enum: [...Object.values(ATTENDANCE_METHODS), null],
      default: null
    },
    checkInCoordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    accuracyMeters: {
      type: Number,
      min: 0
    },
    distanceMeters: {
      type: Number,
      min: 0
    },
    checkedInAt: {
      type: Date
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      default: ''
    },
    auditHistory: {
      type: [auditEntrySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate attendance records for the same worker and job
attendanceSchema.index({ job: 1, worker: 1 }, { unique: true });
attendanceSchema.index({ employer: 1, job: 1 });
attendanceSchema.index({ worker: 1, status: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
