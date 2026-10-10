import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      required: [true, 'Review text is required'],
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['published', 'flagged', 'hidden'],
      default: 'published'
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate review by same reviewer for the same assignment
reviewSchema.index({ assignment: 1, reviewer: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
