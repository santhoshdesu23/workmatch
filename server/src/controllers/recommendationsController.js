import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { JOB_STATUSES, ROLES } from '../config/constants.js';
import { computeJobMatch, sanitizeSkills } from '../services/matchingService.js';
import { aiExplanationService } from '../services/aiExplanationService.js';

export const getJobRecommendations = async (req, res, next) => {
  try {
    const workerId = req.user._id;
    const workerProfile = await WorkerProfile.findOne({ user: workerId }).lean();

    // Case D: Missing or incomplete profile document
    if (!workerProfile) {
      return res.status(200).json({
        success: true,
        recommendations: [],
        totalMatched: 0,
        requiresProfileCompletion: true,
        hasSkills: false,
        message: 'Complete your profile to get AI matches.',
        evaluatedAt: new Date().toISOString()
      });
    }

    // Case A & D: Worker has no declared skills
    const sanitizedWorkerSkills = sanitizeSkills(workerProfile.skills);
    if (sanitizedWorkerSkills.length === 0) {
      return res.status(200).json({
        success: true,
        recommendations: [],
        totalMatched: 0,
        requiresProfileCompletion: true,
        hasSkills: false,
        message: 'Add your skills and work preferences so WorkMatch can find relevant opportunities for you.',
        evaluatedAt: new Date().toISOString()
      });
    }

    // Case B: Worker has skills
    const { limit = 20, minScore = 40, maxDistanceKm } = req.query;

    const openJobs = await Job.find({ status: JOB_STATUSES.OPEN })
      .populate('employer', 'name email verificationStatus')
      .lean();

    const employerIds = openJobs.map((j) => j.employer?._id).filter(Boolean);
    const employerProfiles = await EmployerProfile.find({ user: { $in: employerIds } }).lean();
    const empProfileMap = new Map();
    employerProfiles.forEach((p) => empProfileMap.set(p.user.toString(), p));

    const scoredJobs = openJobs.map((job) => {
      const matchResult = computeJobMatch(workerProfile, job);
      const empProf = empProfileMap.get(job.employer?._id?.toString());

      return {
        ...job,
        employerProfile: empProf
          ? {
              businessName: empProf.businessName,
              verificationStatus: empProf.verificationStatus,
              rating: empProf.rating
            }
          : null,
        matchData: matchResult
      };
    });

    // Distance boundary check:
    // If worker has coordinates, exclude shifts that are excessively distant from their travel radius
    const workerHasCoords =
      workerProfile.location?.coordinates &&
      Array.isArray(workerProfile.location.coordinates) &&
      workerProfile.location.coordinates.length >= 2 &&
      !(workerProfile.location.coordinates[0] === 0 && workerProfile.location.coordinates[1] === 0);

    const maxAllowedDist = maxDistanceKm
      ? Number(maxDistanceKm)
      : (workerProfile.travelRadiusKm ? Math.max(50, Number(workerProfile.travelRadiusKm) * 2) : 50);

    // Case B & Case C: Exclude jobs with unrelated skills, excessive distance, and jobs below threshold
    // If a job specifies required skills, worker MUST match at least one required skill
    const filteredJobs = scoredJobs
      .filter((j) => {
        const jobReqSkills = sanitizeSkills(j.requiredSkills);
        if (jobReqSkills.length > 0 && (!j.matchData.matchedSkills || j.matchData.matchedSkills.length === 0)) {
          return false;
        }

        // Location distance boundary: exclude jobs exceeding travel radius / boundary
        if (workerHasCoords && j.matchData.distanceKm !== null && j.matchData.distanceKm > maxAllowedDist) {
          return false;
        }

        return j.matchData.matchScore >= Number(minScore);
      })
      .sort((a, b) => b.matchData.matchScore - a.matchData.matchScore)
      .slice(0, Number(limit));

    res.status(200).json({
      success: true,
      recommendations: filteredJobs,
      totalMatched: filteredJobs.length,
      requiresProfileCompletion: false,
      hasSkills: true,
      message: filteredJobs.length > 0
        ? 'Recommendations generated successfully.'
        : 'No matching jobs found yet. Try updating your skills or preferences, or check again later.',
      evaluatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const explainRecommendation = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    const workerId = req.user._id;

    const [workerProfile, job] = await Promise.all([
      WorkerProfile.findOne({ user: workerId }).lean(),
      Job.findById(jobId).lean()
    ]);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const matchResult = computeJobMatch(workerProfile, job);
    const aiExplanation = await aiExplanationService.generateMatchExplanation(
      workerProfile,
      job,
      matchResult
    );

    res.status(200).json({
      success: true,
      matchData: matchResult,
      aiExplanation
    });
  } catch (error) {
    next(error);
  }
};

export const parseNlSearch = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query string required.' });
    }

    const parsed = await aiExplanationService.parseNaturalLanguageSearch(query);

    res.status(200).json({
      success: true,
      parsed
    });
  } catch (error) {
    next(error);
  }
};
