import { Review } from '../models/Review.js';
import { Assignment } from '../models/Assignment.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { ASSIGNMENT_STATUSES, ROLES } from '../config/constants.js';

export const createReview = async (req, res, next) => {
  try {
    const { assignmentId, rating, reviewText } = req.body;
    const reviewerId = req.user._id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
    }

    if (!reviewText || reviewText.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Review text must be at least 5 characters long.' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (assignment.status !== ASSIGNMENT_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted for completed assignments.'
      });
    }

    const isWorker = assignment.worker.toString() === reviewerId.toString();
    const isEmployer = assignment.employer.toString() === reviewerId.toString();

    if (!isWorker && !isEmployer) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this assignment.' });
    }

    const revieweeId = isWorker ? assignment.employer : assignment.worker;

    // Check duplicate
    const existing = await Review.findOne({ assignment: assignmentId, reviewer: reviewerId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already submitted a review for this assignment.' });
    }

    const review = await Review.create({
      assignment: assignmentId,
      reviewer: reviewerId,
      reviewee: revieweeId,
      rating: Number(rating),
      reviewText: reviewText.trim()
    });

    // Update aggregate rating on profile
    const allReviews = await Review.find({ reviewee: revieweeId, status: 'published' });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    if (isWorker) {
      // Worker reviewed employer
      await EmployerProfile.findOneAndUpdate(
        { user: revieweeId },
        { rating: { average: roundedAvg, count: allReviews.length } }
      );
    } else {
      // Employer reviewed worker
      await WorkerProfile.findOneAndUpdate(
        { user: revieweeId },
        { rating: { average: roundedAvg, count: allReviews.length } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      review
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const reviews = await Review.find({ reviewee: userId, status: 'published' })
      .populate('reviewer', 'name')
      .populate('assignment')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    next(error);
  }
};
