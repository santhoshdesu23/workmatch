import mongoose from 'mongoose';

const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    otpHash: {
      type: String
    },
    attempts: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      index: { expires: '15m' } // MongoDB TTL index clears document after 15m
    },
    lastSentAt: {
      type: Date
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verificationToken: {
      type: String
    },
    verifiedExpires: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const EmailOtp = mongoose.model('EmailOtp', emailOtpSchema);
