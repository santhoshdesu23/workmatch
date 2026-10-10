import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Application } from '../models/Application.js';
import { JOB_STATUSES, ROLES } from '../config/constants.js';
import { computeJobMatch, calculateDistanceKm } from '../services/matchingService.js';
import { createNotification } from '../services/notificationService.js';

export const getJobs = async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPay,
      maxPay,
      payBasis,
      workDate,
      lat,
      lng,
      maxDistanceKm,
      sort = 'recent',
      page = 1,
      limit = 20
    } = req.query;

    const query = { status: JOB_STATUSES.OPEN };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { requiredSkills: { $regex: search, $options: 'i' } },
        { locationName: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (minPay || maxPay) {
      query.grossPay = {};
      if (minPay) query.grossPay.$gte = Number(minPay);
      if (maxPay) query.grossPay.$lte = Number(maxPay);
    }

    if (payBasis) {
      query.payBasis = payBasis;
    }

    if (workDate) {
      const d = new Date(workDate);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      query.workDate = { $gte: d, $lt: nextDay };
    }

    let workerProfile = null;
    if (req.user && req.user.role === ROLES.WORKER) {
      workerProfile = await WorkerProfile.findOne({ user: req.user._id });
    }

    let jobs = await Job.find(query)
      .populate('employer', 'name email verificationStatus')
      .lean();

    // Attach employer profile info
    const employerUserIds = jobs.map((j) => j.employer?._id).filter(Boolean);
    const employerProfiles = await EmployerProfile.find({ user: { $in: employerUserIds } }).lean();
    const empProfileMap = new Map();
    employerProfiles.forEach((p) => empProfileMap.set(p.user.toString(), p));

    const originLat = lat ? Number(lat) : workerProfile?.location?.coordinates?.[1];
    const originLng = lng ? Number(lng) : workerProfile?.location?.coordinates?.[0];

    // Compute distance and match scores
    jobs = jobs.map((job) => {
      const empProf = empProfileMap.get(job.employer?._id?.toString());
      let distanceKm = null;
      if (originLat && originLng && job.location?.coordinates?.[1] && job.location?.coordinates?.[0]) {
        distanceKm = calculateDistanceKm(
          originLat,
          originLng,
          job.location.coordinates[1],
          job.location.coordinates[0]
        );
      }

      let matchData = null;
      if (workerProfile) {
        matchData = computeJobMatch(workerProfile, job);
      }

      return {
        ...job,
        employerProfile: empProf
          ? {
              businessName: empProf.businessName,
              verificationStatus: empProf.verificationStatus,
              rating: empProf.rating
            }
          : null,
        distanceKm,
        matchData
      };
    });

    // Distance filter if requested
    if (maxDistanceKm) {
      const maxDist = Number(maxDistanceKm);
      jobs = jobs.filter((j) => j.distanceKm === null || j.distanceKm <= maxDist);
    }

    // Sorting
    if (sort === 'highest_pay') {
      jobs.sort((a, b) => b.grossPay - a.grossPay);
    } else if (sort === 'nearest') {
      jobs.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sort === 'soonest') {
      jobs.sort((a, b) => new Date(a.workDate) - new Date(b.workDate));
    } else if (sort === 'best_match' && workerProfile) {
      jobs.sort((a, b) => (b.matchData?.matchScore || 0) - (a.matchData?.matchScore || 0));
    } else {
      // Default: recent
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const total = jobs.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = jobs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.status(200).json({
      success: true,
      jobs: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId)
      .populate('employer', 'name email verificationStatus')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    // Increment view count asynchronously
    Job.findByIdAndUpdate(jobId, { $inc: { viewsCount: 1 } }).exec();

    const empProfile = await EmployerProfile.findOne({ user: job.employer?._id }).lean();

    let userApplication = null;
    let matchData = null;
    let isSaved = false;

    if (req.user && req.user.role === ROLES.WORKER) {
      const workerProfile = await WorkerProfile.findOne({ user: req.user._id }).lean();
      if (workerProfile) {
        matchData = computeJobMatch(workerProfile, job);
        isSaved = workerProfile.savedJobs?.some((s) => s.toString() === jobId);
      }
      userApplication = await Application.findOne({ job: jobId, worker: req.user._id }).lean();
    }

    res.status(200).json({
      success: true,
      job: {
        ...job,
        employerProfile: empProfile
          ? {
              businessName: empProfile.businessName,
              description: empProfile.description,
              businessAddress: empProfile.businessAddress,
              verificationStatus: empProfile.verificationStatus,
              rating: empProfile.rating,
              publicContact: empProfile.publicContact
            }
          : null,
        matchData,
        userApplication,
        isSaved
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createJob = async (req, res, next) => {
  try {
    const employerId = req.user._id;
    const {
      title,
      description,
      category,
      requiredSkills,
      openings,
      locationName,
      coordinates, // [lng, lat]
      workDate,
      startTime,
      endTime,
      breakDurationMinutes = 30,
      totalHours,
      grossPay,
      payBasis = 'hourly',
      currency = 'USD',
      paymentMethod,
      paymentTiming,
      experienceRequirement,
      dressCode,
      physicalRequirements,
      ageRestriction,
      applicationDeadline,
      cancellationPolicy,
      status = JOB_STATUSES.OPEN
    } = req.body;

    const job = await Job.create({
      employer: employerId,
      title,
      description,
      category,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills || '').split(',').map((s) => s.trim()).filter(Boolean),
      openings: Number(openings) || 1,
      locationName,
      location: {
        type: 'Point',
        coordinates: coordinates && coordinates.length === 2 ? coordinates : [0, 0]
      },
      workDate,
      startTime,
      endTime,
      breakDurationMinutes: Number(breakDurationMinutes) || 0,
      totalHours: Number(totalHours) || 1,
      grossPay: Number(grossPay),
      payBasis,
      currency,
      paymentMethod,
      paymentTiming,
      experienceRequirement,
      dressCode,
      physicalRequirements,
      ageRestriction,
      applicationDeadline: applicationDeadline || workDate,
      cancellationPolicy,
      status
    });

    await EmployerProfile.findOneAndUpdate(
      { user: employerId },
      { $inc: { totalJobsPosted: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully.',
      job
    });
  } catch (error) {
    next(error);
  }
};

export const updateJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this job.' });
    }

    const updates = { ...req.body };
    if (updates.coordinates && updates.coordinates.length === 2) {
      updates.location = { type: 'Point', coordinates: updates.coordinates };
      delete updates.coordinates;
    }
    if (typeof updates.requiredSkills === 'string') {
      updates.requiredSkills = updates.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const updatedJob = await Job.findByIdAndUpdate(jobId, updates, { new: true, runValidators: true });

    res.status(200).json({
      success: true,
      message: 'Job updated successfully.',
      job: updatedJob
    });
  } catch (error) {
    next(error);
  }
};

export const cancelJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { reason = 'Cancelled by employer' } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    job.status = JOB_STATUSES.CANCELLED;
    await job.save();

    // Notify any active applicants
    const activeApplications = await Application.find({
      job: jobId,
      status: { $in: ['APPLIED', 'SHORTLISTED', 'OFFERED', 'ACCEPTED', 'HIRED'] }
    });

    for (const app of activeApplications) {
      app.status = 'CANCELLED';
      app.decisionHistory.push({
        status: 'CANCELLED',
        note: `Job cancelled: ${reason}`,
        changedBy: req.user._id
      });
      await app.save();

      await createNotification({
        recipient: app.worker,
        type: 'APPLICATION_STATUS',
        title: `Job Cancelled: ${job.title}`,
        message: `The employer has cancelled this job posting: "${reason}".`,
        link: `/worker/applications`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job cancelled and applicants notified.',
      job
    });
  } catch (error) {
    next(error);
  }
};

export const toggleSaveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const workerProfile = await WorkerProfile.findOne({ user: req.user._id });
    if (!workerProfile) {
      return res.status(404).json({ success: false, message: 'Worker profile not found.' });
    }

    const isAlreadySaved = workerProfile.savedJobs.some((s) => s.toString() === jobId);
    if (isAlreadySaved) {
      workerProfile.savedJobs = workerProfile.savedJobs.filter((s) => s.toString() !== jobId);
      await workerProfile.save();
      return res.status(200).json({ success: true, isSaved: false, message: 'Job removed from saved bookmarks.' });
    } else {
      workerProfile.savedJobs.push(jobId);
      await workerProfile.save();
      return res.status(200).json({ success: true, isSaved: true, message: 'Job saved to your bookmarks.' });
    }
  } catch (error) {
    next(error);
  }
};
