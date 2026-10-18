import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    reportedJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      index: true
    },
    category: {
      type: String,
      enum: [
        'scam_or_fraud',
        'unpaid_wage',
        'harassment',
        'misleading_job',
        'unsafe_conditions',
        'no_show',
        'other',
        'pay_mismatch',
        'schedule_mismatch',
        'location_mismatch',
        'duties_mismatch',
        'unexpected_cancellation'
      ],
      required: true
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      maxlength: 1500
    },
    evidence: {
      type: String,
      default: '',
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    substantiated: {
      type: Boolean,
      default: false,
      index: true
    },
    resolutionNotes: {
      type: String,
      default: ''
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

reportSchema.index({ reporter: 1, reportedJob: 1, category: 1, status: 1 });
reportSchema.index({ reportedUser: 1, substantiated: 1, status: 1 });

export const Report = mongoose.model('Report', reportSchema);
