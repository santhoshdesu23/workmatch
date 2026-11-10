import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { JOB_STATUSES } from '../config/constants.js';
import {
  computeJobMatch,
  sanitizeSkills,
  partitionMixedJobMatches,
  PROVENANCE_SOURCES
} from '../services/matchingService.js';
import { aiExplanationService } from '../services/aiExplanationService.js';
import {
  isJobOpenForApplications,
  isJobApplicationDeadlinePassed,
  isJobWorkEnded,
  isJobWorkOngoing,
  getEffectiveJobStatus
} from '../utils/scheduleUtils.js';

export const getJobRecommendations = async (req, res, next) => {
  try {
    const workerId = req.user._id;
    const workerProfile = await WorkerProfile.findOne({ user: workerId }).lean();

    // Case D: Missing or incomplete profile document
    if (!workerProfile) {
      return res.status(200).json({
        success: true,
        results: { exact: [], strong: [], partial: [] },
        counts: { exact: 0, strong: 0, partial: 0, total: 0 },
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
        results: { exact: [], strong: [], partial: [] },
        counts: { exact: 0, strong: 0, partial: 0, total: 0 },
        recommendations: [],
        totalMatched: 0,
        requiresProfileCompletion: true,
        hasSkills: false,
        message: 'Add your skills and work preferences so WorkMatch can find relevant opportunities for you.',
        evaluatedAt: new Date().toISOString()
      });
    }

    // Case B: Worker has skills
    const { limit = 20, minScore = 40, maxDistanceKm, showCloseMatches } = req.query;

    // Bounded candidate scoring: retrieve at most 200 open jobs
    const openJobs = await Job.find({ status: JOB_STATUSES.OPEN })
      .limit(200)
      .populate('employer', 'name email verificationStatus')
      .lean();

    const now = new Date();
    const availableJobs = openJobs.filter((job) => isJobOpenForApplications(job, now));

    const employerIds = availableJobs.map((j) => j.employer?._id).filter(Boolean);
    const employerProfiles = await EmployerProfile.find({ user: { $in: employerIds } }).lean();
    const empProfileMap = new Map();
    employerProfiles.forEach((p) => empProfileMap.set(p.user.toString(), p));

    const enrichedJobs = availableJobs.map((job) => {
      const empProf = empProfileMap.get(job.employer?._id?.toString());
      return {
        ...job,
        isDeadlinePassed: isJobApplicationDeadlinePassed(job, now),
        isWorkEnded: isJobWorkEnded(job, now),
        isWorkOngoing: isJobWorkOngoing(job, now),
        effectiveStatus: getEffectiveJobStatus(job, now),
        employerProfile: empProf
          ? {
              businessName: empProf.businessName,
              verificationStatus: empProf.verificationStatus,
              rating: empProf.rating
            }
          : null
      };
    });

    const filters = {};
    if (maxDistanceKm) filters.maxDistanceKm = Number(maxDistanceKm);

    const partitionResult = partitionMixedJobMatches(enrichedJobs, {
      workerProfile,
      filters,
      provenanceMap: {
        maxDistanceKm: PROVENANCE_SOURCES.UI_FILTER
      },
      showCloseMatches: showCloseMatches !== 'false' && showCloseMatches !== false,
      now
    });

    // Also attach matchData for backward compatibility with existing tests
    const attachMatchData = (j) => ({
      ...j,
      matchData: computeJobMatch(workerProfile, j)
    });

    const finalExact = partitionResult.results.exact.map(attachMatchData);
    const finalStrong = partitionResult.results.strong.map(attachMatchData);
    const finalPartial = partitionResult.results.partial.map(attachMatchData);

    const flatRecommendations = [...finalExact, ...finalStrong, ...finalPartial]
      .filter((j) => (j.matchScore || j.matchData?.matchScore || 0) >= Number(minScore))
      .slice(0, Number(limit));

    res.status(200).json({
      success: true,
      results: {
        exact: finalExact,
        strong: finalStrong,
        partial: finalPartial
      },
      counts: partitionResult.counts,
      appliedRequirements: partitionResult.appliedRequirements,
      recommendations: flatRecommendations,
      totalMatched: flatRecommendations.length,
      requiresProfileCompletion: false,
      hasSkills: true,
      message: flatRecommendations.length > 0
        ? 'Recommendations generated successfully.'
        : 'No matching jobs found yet. Try updating your skills or preferences, or check again later.',
      evaluatedAt: partitionResult.evaluatedAt
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
