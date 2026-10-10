import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'APPLICATION_STATUS',
        'OFFER_RECEIVED',
        'JOB_MATCH',
        'SHIFT_UPCOMING',
        'COMPLETION_REQUEST',
        'PAYMENT_UPDATE',
        'REVIEW_RECEIVED',
        'VERIFICATION_UPDATE',
        'SYSTEM'
      ],
      default: 'SYSTEM'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    relatedResource: {
      resourceType: { type: String, default: '' },
      resourceId: { type: mongoose.Schema.Types.ObjectId }
    },
    link: {
      type: String,
      default: ''
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
