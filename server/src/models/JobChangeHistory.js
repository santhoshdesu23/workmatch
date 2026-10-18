import mongoose from 'mongoose';

const jobChangeHistorySchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actorRole: {
      type: String,
      enum: ['employer', 'admin'],
      required: true
    },
    changedFields: {
      type: [String],
      required: true
    },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        isMaterial: { type: Boolean, default: false }
      }
    ],
    isMaterial: {
      type: Boolean,
      default: false,
      index: true
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

jobChangeHistorySchema.index({ job: 1, createdAt: -1 });

export const JobChangeHistory = mongoose.model('JobChangeHistory', jobChangeHistorySchema);
