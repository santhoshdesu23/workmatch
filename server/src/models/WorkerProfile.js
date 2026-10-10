import mongoose from 'mongoose';

const workerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    bio: {
      type: String,
      default: '',
      maxlength: 1000
    },
    skills: {
      type: [String],
      default: [],
      index: true
    },
    experienceSummary: {
      type: String,
      default: ''
    },
    preferredCategories: {
      type: [String],
      default: [],
      index: true
    },
    preferredLocationName: {
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
    travelRadiusKm: {
      type: Number,
      default: 25,
      min: 1,
      max: 100
    },
    availability: {
      isAvailable: {
        type: Boolean,
        default: true
      },
      days: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      timeSlots: {
        type: [String],
        default: ['Morning', 'Afternoon', 'Evening']
      }
    },
    expectedPay: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      basis: { type: String, enum: ['hourly', 'daily', 'shift', 'task'], default: 'hourly' }
    },
    languages: {
      type: [String],
      default: ['English']
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
    completedJobsCount: {
      type: Number,
      default: 0
    },
    savedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
      }
    ]
  },
  {
    timestamps: true
  }
);

workerProfileSchema.index({ location: '2dsphere' });

export const WorkerProfile = mongoose.model('WorkerProfile', workerProfileSchema);
