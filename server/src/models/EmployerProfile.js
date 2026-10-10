import mongoose from 'mongoose';

const employerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: 150
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000
    },
    businessCategory: {
      type: String,
      default: 'General'
    },
    businessAddress: {
      type: String,
      default: ''
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    publicContact: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      website: { type: String, default: '' }
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified'
    },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    totalJobsPosted: {
      type: Number,
      default: 0
    },
    totalHiredWorkers: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

employerProfileSchema.index({ location: '2dsphere' });

export const EmployerProfile = mongoose.model('EmployerProfile', employerProfileSchema);
