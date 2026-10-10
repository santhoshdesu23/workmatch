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
        'other'
      ],
      required: true
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      maxlength: 1500
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending',
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

export const Report = mongoose.model('Report', reportSchema);
