import { Assignment } from '../models/Assignment.js';
import { Report } from '../models/Report.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { ASSIGNMENT_STATUSES } from '../config/constants.js';

const MINIMUM_HISTORY_ASSIGNMENTS = 3;

/**
 * Computes an evidence-based employer reliability summary using actual persisted records.
 * Adheres strictly to the TrustTrack principles:
 * - Excludes pending, investigating, dismissed, or unsubstantiated reports from mismatch counts.
 * - Requires a meaningful denominator before computing rates.
 * - Handles employers with insufficient history gracefully with "Not enough history yet".
 * - Clearly distinguishes verified business identity from historical shift reliability.
 * - Explains how each metric is calculated with transparent documentation.
 *
 * @param {string|mongoose.Types.ObjectId} employerId
 * @returns {Promise<Object>}
 */
export async function computeEmployerReliability(employerId) {
  if (!employerId) return null;

  const [
    user,
    profile,
    completedAssignments,
    totalInitiatedAssignments,
    employerCancellations,
    substantiatedMismatches,
    reviews
  ] = await Promise.all([
    User.findById(employerId).select('name verificationStatus createdAt').lean(),
    EmployerProfile.findOne({ user: employerId }).select('businessName verificationStatus totalJobsPosted totalHiredWorkers').lean(),
    Assignment.countDocuments({ employer: employerId, status: ASSIGNMENT_STATUSES.COMPLETED }),
    Assignment.countDocuments({
      employer: employerId,
      status: {
        $in: [
          ASSIGNMENT_STATUSES.CONFIRMED,
          ASSIGNMENT_STATUSES.IN_PROGRESS,
          ASSIGNMENT_STATUSES.COMPLETED,
          ASSIGNMENT_STATUSES.CANCELLED,
          ASSIGNMENT_STATUSES.NO_SHOW
        ]
      }
    }),
    Assignment.countDocuments({
      employer: employerId,
      status: ASSIGNMENT_STATUSES.CANCELLED,
      cancelledBy: employerId
    }),
    Report.countDocuments({
      reportedUser: employerId,
      status: 'resolved',
      substantiated: true
    }),
    Review.find({ reviewee: employerId, status: 'published' }).select('rating').lean()
  ]);

  if (!user && !profile) {
    return null;
  }

  const hasSufficientHistory = totalInitiatedAssignments >= MINIMUM_HISTORY_ASSIGNMENTS;

  const completionRate = hasSufficientHistory && totalInitiatedAssignments > 0
    ? Math.round((completedAssignments / totalInitiatedAssignments) * 100)
    : null;

  const cancellationRate = hasSufficientHistory && totalInitiatedAssignments > 0
    ? Math.round((employerCancellations / totalInitiatedAssignments) * 100)
    : null;

  const totalReviews = reviews.length;
  const ratingAverage = totalReviews > 0
    ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  return {
    employerId: String(employerId),
    businessName: profile?.businessName || user?.name || 'Employer',
    identityVerificationStatus: user?.verificationStatus || profile?.verificationStatus || 'unverified',
    hasSufficientHistory,
    minimumThresholdRequired: MINIMUM_HISTORY_ASSIGNMENTS,
    metrics: {
      completedAssignments,
      totalInitiatedAssignments,
      employerCancellations,
      completionRate, // null if insufficient history
      cancellationRate, // null if insufficient history
      substantiatedMismatches,
      ratingAverage,
      ratingCount: totalReviews
    },
    explanations: {
      completionRate: 'Percentage of confirmed shifts completed without employer cancellation (minimum 3 shifts required to display rate).',
      cancellationRate: 'Percentage of confirmed shifts cancelled directly by the employer after hiring.',
      substantiatedMismatches: 'Discrepancy reports reviewed, investigated, and confirmed by administrators. Pending and dismissed reports are excluded.',
      rating: 'Average score from reviews submitted by workers who actually finished shifts with this employer.',
      identityVerificationNotice: 'Identity verification reflects business document review and is evaluated separately from operational shift fulfillment.'
    }
  };
}
