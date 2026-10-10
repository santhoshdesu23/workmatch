import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { JOB_STATUSES, ROLES } from '../config/constants.js';
import { computeJobMatch } from '../services/matchingService.js';
import { aiExplanationService } from '../services/aiExplanationService.js';

export const getJobRecommendations = async (req, res, next) => {
  try {
    const workerId = req.user._id;
    const workerProfile = await WorkerProfile.findOne({ user: workerId }).lean();

    if (!workerProfile) {
      return res.status(404).json({ success: false, message: 'Worker profile required for recommendations.' });
    }

    const { limit = 20, minScore = 40 } = req.query;

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

    // Filter by minimum score and sort by match score descending
    const filteredJobs = scoredJobs
      .filter((j) => j.matchData.matchScore >= Number(minScore))
      .sort((a, b) => b.matchData.matchScore - a.matchData.matchScore)
      .slice(0, Number(limit));

    res.status(200).json({
      success: true,
      recommendations: filteredJobs,
      totalMatched: filteredJobs.length,
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
