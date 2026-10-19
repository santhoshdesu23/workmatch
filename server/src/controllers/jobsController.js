import { Job } from '../models/Job.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { User } from '../models/User.js';
import { JobChangeHistory } from '../models/JobChangeHistory.js';
import { JOB_STATUSES, ROLES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES } from '../config/constants.js';
import { computeJobMatch, calculateDistanceKm } from '../services/matchingService.js';
import { createNotification } from '../services/notificationService.js';
import { computeEmployerReliability } from '../services/reliabilityService.js';

const MATERIAL_FIELDS = [
  'title',
  'description',
  'category',
  'grossPay',
  'payBasis',
  'workDate',
  'startTime',
  'endTime',
  'totalHours',
  'locationName',
  'openings',
  'requiredSkills',
  'cancellationPolicy',
  'applicationDeadline'
];

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
      locality,
      city,
      district,
      state,
      location,
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
        { locationName: { $regex: search, $options: 'i' } },
        { locality: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }

    if (locality) {
      query.locality = { $regex: `^${locality.trim()}$`, $options: 'i' };
    }

    if (city) {
      query.city = { $regex: `^${city.trim()}$`, $options: 'i' };
    }

    if (district) {
      query.district = { $regex: `^${district.trim()}$`, $options: 'i' };
    }

    if (state) {
      query.state = { $regex: `^${state.trim()}$`, $options: 'i' };
    }

    if (location && !locality && !city && !district) {
      const locTerm = location.trim();
      const locOr = [
        { locality: { $regex: locTerm, $options: 'i' } },
        { city: { $regex: locTerm, $options: 'i' } },
        { district: { $regex: locTerm, $options: 'i' } },
        { locationName: { $regex: locTerm, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: locOr }];
        delete query.$or;
      } else {
        query.$or = locOr;
      }
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

    // Reliable origin coordinates parsing
    let originLat = null;
    let originLng = null;

    if (lat !== undefined && lat !== '' && !isNaN(Number(lat))) {
      originLat = Number(lat);
    } else if (
      workerProfile?.location?.coordinates &&
      Array.isArray(workerProfile.location.coordinates) &&
      workerProfile.location.coordinates.length >= 2 &&
      !isNaN(Number(workerProfile.location.coordinates[1])) &&
      !(workerProfile.location.coordinates[0] === 0 && workerProfile.location.coordinates[1] === 0)
    ) {
      originLat = Number(workerProfile.location.coordinates[1]);
    }

    if (lng !== undefined && lng !== '' && !isNaN(Number(lng))) {
      originLng = Number(lng);
    } else if (
      workerProfile?.location?.coordinates &&
      Array.isArray(workerProfile.location.coordinates) &&
      workerProfile.location.coordinates.length >= 2 &&
      !isNaN(Number(workerProfile.location.coordinates[0])) &&
      !(workerProfile.location.coordinates[0] === 0 && workerProfile.location.coordinates[1] === 0)
    ) {
      originLng = Number(workerProfile.location.coordinates[0]);
    }

    // Compute distance and match scores
    jobs = jobs.map((job) => {
      const empProf = empProfileMap.get(job.employer?._id?.toString());
      let distanceKm = null;

      const hasJobCoords =
        job.location?.coordinates &&
        Array.isArray(job.location.coordinates) &&
        job.location.coordinates.length >= 2 &&
        job.location.coordinates[0] != null &&
        job.location.coordinates[1] != null &&
        !isNaN(Number(job.location.coordinates[0])) &&
        !isNaN(Number(job.location.coordinates[1])) &&
        !(Number(job.location.coordinates[0]) === 0 && Number(job.location.coordinates[1]) === 0);

      const hasOriginCoords =
        originLat !== null &&
        originLng !== null &&
        !(originLat === 0 && originLng === 0);

      if (hasOriginCoords && hasJobCoords) {
        distanceKm = calculateDistanceKm(
          originLat,
          originLng,
          Number(job.location.coordinates[1]),
          Number(job.location.coordinates[0])
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

    // Distance radius filter: Only retain jobs with reliable distance within maxDistanceKm
    if (maxDistanceKm) {
      const maxDist = Number(maxDistanceKm);
      if (!isNaN(maxDist) && maxDist > 0) {
        // Distant jobs and jobs with missing coordinates (cannot be proven nearby) are excluded
        jobs = jobs.filter((j) => j.distanceKm !== null && j.distanceKm <= maxDist);
      }
    }

    // Sorting
    if (sort === 'highest_pay') {
      jobs.sort((a, b) => b.grossPay - a.grossPay);
    } else if (sort === 'nearest') {
      jobs.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
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
      total,
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
    const employerReliability = await computeEmployerReliability(job.employer?._id);
    const changeHistoryCount = await JobChangeHistory.countDocuments({ job: jobId });

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
        employerReliability,
        changeHistoryCount,
        matchData,
        userApplication,
        isSaved
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getJobHistory = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId).select('_id title employer').lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    const history = await JobChangeHistory.find({ job: jobId })
      .populate('actor', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      jobId,
      history
    });
  } catch (error) {
    next(error);
  }
};

export const createJob = async (req, res, next) => {
  try {
    const employerId = req.user._id;

    // Enforce mandatory email verification for employers before creating jobs
    const employer = await User.findById(employerId);
    if (!employer || (!employer.emailVerified && employer.role !== ROLES.ADMIN)) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required before you can post jobs. Please verify your email address.'
      });
    }

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
      currency = 'INR',
      paymentMethod,
      paymentTiming,
      experienceRequirement,
      dressCode,
      physicalRequirements,
      ageRestriction,
      applicationDeadline,
      cancellationPolicy,
      detailsConfirmed = true,
      status = JOB_STATUSES.OPEN
    } = req.body;

    // Validation checks
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Job title is required (at least 3 characters).' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Job description is required (at least 10 characters).' });
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Job category is required.' });
    }
    const trimmedCategory = category.trim();
    if (trimmedCategory.length > 60) {
      return res.status(400).json({ success: false, message: 'Job category cannot exceed 60 characters.' });
    }
    if (!locationName || !locationName.trim()) {
      return res.status(400).json({ success: false, message: 'Location address or venue description is required.' });
    }
    if (!workDate) {
      return res.status(400).json({ success: false, message: 'Work date is required.' });
    }

    const parsedWorkDate = new Date(workDate);
    if (isNaN(parsedWorkDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid work date format.' });
    }

    // Work date must not be in the past (allow timezone buffer)
    const minAllowedDate = new Date();
    minAllowedDate.setHours(0, 0, 0, 0);
    minAllowedDate.setDate(minAllowedDate.getDate() - 1);
    if (parsedWorkDate < minAllowedDate) {
      return res.status(400).json({ success: false, message: 'Work date cannot be in the past.' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Shift start and end times are required.' });
    }

    const parsedGrossPay = Number(grossPay);
    if (isNaN(parsedGrossPay) || parsedGrossPay <= 0) {
      return res.status(400).json({ success: false, message: 'Gross pay must be a positive number.' });
    }

    const parsedTotalHours = Number(totalHours);
    if (isNaN(parsedTotalHours) || parsedTotalHours <= 0) {
      return res.status(400).json({ success: false, message: 'Total hours must be greater than zero.' });
    }

    if (applicationDeadline) {
      const parsedDeadline = new Date(applicationDeadline);
      if (isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid application deadline format.' });
      }
    }

    const isConfirmed = detailsConfirmed !== false;

    const job = await Job.create({
      employer: employerId,
      title: title.trim(),
      description: description.trim(),
      category: trimmedCategory,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills || '').split(',').map((s) => s.trim()).filter(Boolean),
      openings: Number(openings) || 1,
      locationName: locationName.trim(),
      location: {
        type: 'Point',
        coordinates: coordinates && coordinates.length === 2 ? coordinates : [0, 0]
      },
      workDate: parsedWorkDate,
      startTime,
      endTime,
      breakDurationMinutes: Number(breakDurationMinutes) || 0,
      totalHours: parsedTotalHours,
      grossPay: parsedGrossPay,
      payBasis,
      currency,
      paymentMethod,
      paymentTiming,
      experienceRequirement,
      dressCode,
      physicalRequirements,
      ageRestriction,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : parsedWorkDate,
      cancellationPolicy,
      detailsConfirmed: isConfirmed,
      detailsConfirmedAt: isConfirmed ? new Date() : null,
      detailsConfirmedBy: isConfirmed ? employerId : null,
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

    // Unverified employers cannot edit or publish jobs
    const employer = await User.findById(req.user._id);
    if (!employer || (!employer.emailVerified && employer.role !== ROLES.ADMIN)) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required before you can edit or publish jobs. Please verify your email address.'
      });
    }

    if (job.status === JOB_STATUSES.CANCELLED || job.status === JOB_STATUSES.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a ${job.status.toLowerCase()} job posting.`
      });
    }

    // Explicit field whitelisting to eliminate mass-assignment vulnerabilities.
    // Privileged/internal fields (employer, filledCount, status, applicationsCount, viewsCount) are strictly forbidden.
    const allowedFields = [
      'title',
      'description',
      'category',
      'requiredSkills',
      'openings',
      'locationName',
      'workDate',
      'startTime',
      'endTime',
      'breakDurationMinutes',
      'totalHours',
      'grossPay',
      'payBasis',
      'currency',
      'paymentMethod',
      'paymentTiming',
      'experienceRequirement',
      'dressCode',
      'physicalRequirements',
      'ageRestriction',
      'applicationDeadline',
      'cancellationPolicy'
    ];

    const safeUpdates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeUpdates[field] = req.body[field];
      }
    }

    // Validate category
    if (safeUpdates.category !== undefined) {
      if (!safeUpdates.category || typeof safeUpdates.category !== 'string' || !safeUpdates.category.trim()) {
        return res.status(400).json({ success: false, message: 'Job category cannot be empty.' });
      }
      safeUpdates.category = safeUpdates.category.trim();
      if (safeUpdates.category.length > 60) {
        return res.status(400).json({ success: false, message: 'Job category cannot exceed 60 characters.' });
      }
    }

    // Validate grossPay
    if (safeUpdates.grossPay !== undefined) {
      const parsedPay = Number(safeUpdates.grossPay);
      if (isNaN(parsedPay) || parsedPay <= 0) {
        return res.status(400).json({ success: false, message: 'Gross pay must be a positive number.' });
      }
      safeUpdates.grossPay = parsedPay;
    }

    // Validate totalHours
    if (safeUpdates.totalHours !== undefined) {
      const parsedHours = Number(safeUpdates.totalHours);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        return res.status(400).json({ success: false, message: 'Total hours must be greater than zero.' });
      }
      safeUpdates.totalHours = parsedHours;
    }

    // Validate workDate
    if (safeUpdates.workDate !== undefined) {
      const parsedDate = new Date(safeUpdates.workDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid work date format.' });
      }
      safeUpdates.workDate = parsedDate;
    }

    // Validate openings against current commitments
    if (safeUpdates.openings !== undefined) {
      const parsedOpenings = Number(safeUpdates.openings);
      if (isNaN(parsedOpenings) || parsedOpenings < 1) {
        return res.status(400).json({ success: false, message: 'Openings must be a positive number.' });
      }
      if (parsedOpenings < job.filledCount) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce openings to ${parsedOpenings}: ${job.filledCount} candidate(s) are already hired for this position.`
        });
      }
      safeUpdates.openings = parsedOpenings;
    }

    // Protection of active assignments: prevent reducing pay or changing schedule under active commitments
    const activeAssignmentsCount = await Assignment.countDocuments({
      job: jobId,
      status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] }
    });

    if (activeAssignmentsCount > 0) {
      if (safeUpdates.grossPay !== undefined && safeUpdates.grossPay < job.grossPay) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce pay rate from ₹${job.grossPay} to ₹${safeUpdates.grossPay}: ${activeAssignmentsCount} candidate(s) are already confirmed for this shift.`
        });
      }
      if (
        (safeUpdates.workDate !== undefined && new Date(safeUpdates.workDate).toISOString().slice(0, 10) !== new Date(job.workDate).toISOString().slice(0, 10)) ||
        (safeUpdates.startTime !== undefined && safeUpdates.startTime !== job.startTime) ||
        (safeUpdates.endTime !== undefined && safeUpdates.endTime !== job.endTime)
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot alter work date or shift times while ${activeAssignmentsCount} active shift assignment(s) are confirmed. Contact workers and administration directly to reschedule.`
        });
      }
    }

    if (req.body.coordinates && Array.isArray(req.body.coordinates) && req.body.coordinates.length === 2) {
      safeUpdates.location = { type: 'Point', coordinates: req.body.coordinates };
    }

    if (typeof safeUpdates.requiredSkills === 'string') {
      safeUpdates.requiredSkills = safeUpdates.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    }

    // Ensure employer ownership cannot be modified
    safeUpdates.employer = job.employer;

    // Detect changes and calculate diff for change history
    const changes = [];
    const changedFieldNames = [];
    let hasMaterialChange = false;

    for (const key of allowedFields) {
      if (safeUpdates[key] !== undefined) {
        const oldVal = job[key];
        const newVal = safeUpdates[key];
        let isDiff = false;

        if (key === 'workDate' || key === 'applicationDeadline') {
          isDiff = new Date(oldVal).toISOString() !== new Date(newVal).toISOString();
        } else if (key === 'requiredSkills') {
          const oldArr = Array.isArray(oldVal) ? oldVal : [];
          const newArr = Array.isArray(newVal) ? newVal : [];
          isDiff = oldArr.join(',') !== newArr.join(',');
        } else if (typeof oldVal === 'number' || typeof newVal === 'number') {
          isDiff = Number(oldVal) !== Number(newVal);
        } else {
          isDiff = String(oldVal ?? '') !== String(newVal ?? '');
        }

        if (isDiff) {
          const isMaterial = MATERIAL_FIELDS.includes(key);
          if (isMaterial) hasMaterialChange = true;
          changedFieldNames.push(key);
          changes.push({
            field: key,
            oldValue: oldVal,
            newValue: newVal,
            isMaterial
          });
        }
      }
    }

    // Record change history if any fields changed
    if (changes.length > 0) {
      await JobChangeHistory.create({
        job: jobId,
        actor: req.user._id,
        actorRole: req.user.role === ROLES.ADMIN ? 'admin' : 'employer',
        changedFields: changedFieldNames,
        changes,
        isMaterial: hasMaterialChange,
        reason: req.body.reason ? String(req.body.reason).slice(0, 500) : ''
      });
    }

    // Notify affected applicants if material changes occurred
    if (hasMaterialChange) {
      const affectedApplications = await Application.find({
        job: jobId,
        status: { $in: ['APPLIED', 'SHORTLISTED', 'OFFERED', 'ACCEPTED'] }
      }).populate('worker', 'name email');

      const friendlyNames = changedFieldNames.map((f) => {
        if (f === 'grossPay') return 'compensation rate';
        if (f === 'workDate') return 'shift date';
        if (f === 'startTime' || f === 'endTime') return 'shift hours';
        if (f === 'locationName') return 'location address';
        if (f === 'openings') return 'available openings';
        return f;
      });
      const distinctNames = Array.from(new Set(friendlyNames));
      const reasonText = req.body.reason ? ` (Reason: "${req.body.reason}")` : '';

      for (const app of affectedApplications) {
        app.decisionHistory.push({
          status: app.status,
          note: `Material shift update: ${distinctNames.join(', ')}${reasonText}`,
          changedBy: req.user._id,
          timestamp: new Date()
        });
        await app.save();

        await createNotification({
          recipient: app.worker._id,
          type: 'APPLICATION_STATUS',
          title: `Shift Updated: ${job.title}`,
          message: `The employer updated details for "${job.title}" (${distinctNames.join(', ')}). Please review the updated shift details and reconfirm your interest if needed.`,
          link: `/jobs/${jobId}`,
          relatedResource: { resourceType: 'Job', resourceId: jobId }
        });
      }
    }

    const updatedJob = await Job.findByIdAndUpdate(jobId, safeUpdates, { new: true, runValidators: true });

    res.status(200).json({
      success: true,
      message: 'Job updated successfully.',
      job: updatedJob,
      changesRecorded: changes.length
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

    if (job.status === JOB_STATUSES.CANCELLED) {
      return res.status(400).json({ success: false, message: 'Job posting is already cancelled.' });
    }

    if (job.status === JOB_STATUSES.COMPLETED) {
      return res.status(400).json({ success: false, message: 'Cannot cancel an already completed job.' });
    }

    job.status = JOB_STATUSES.CANCELLED;
    await job.save();

    // 1. Notify and cancel all active applications
    const activeApplications = await Application.find({
      job: jobId,
      status: { $in: ['APPLIED', 'SHORTLISTED', 'OFFERED', 'ACCEPTED', 'HIRED'] }
    });

    for (const app of activeApplications) {
      app.status = 'CANCELLED';
      app.decisionHistory.push({
        status: 'CANCELLED',
        note: `Job cancelled: ${reason}`,
        changedBy: req.user._id,
        timestamp: new Date()
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

    // 2. Cascade cancellation to active assignments (CONFIRMED or IN_PROGRESS), preserving COMPLETED
    const activeAssignments = await Assignment.find({
      job: jobId,
      status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] }
    });

    for (const assignment of activeAssignments) {
      assignment.status = ASSIGNMENT_STATUSES.CANCELLED;
      assignment.cancellationReason = String(reason || 'Job cancelled by employer').slice(0, 500);
      assignment.cancelledBy = req.user._id;
      await assignment.save();

      await createNotification({
        recipient: assignment.worker,
        type: 'APPLICATION_STATUS',
        title: `Shift Cancelled: ${job.title}`,
        message: `Your shift assignment for "${job.title}" has been cancelled because the job was cancelled by the employer.`,
        link: '/worker/assignments'
      });
    }

    // 3. Cascade cancellation to unfulfilled payment obligations (DUE), preserving PAID or PROCESSING
    await PaymentRecord.updateMany(
      { job: jobId, status: PAYMENT_STATUSES.DUE },
      {
        $set: { status: PAYMENT_STATUSES.CANCELLED },
        $push: {
          history: {
            status: PAYMENT_STATUSES.CANCELLED,
            note: 'Job cancelled by employer before work performed.',
            updatedBy: req.user._id,
            timestamp: new Date()
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Job cancelled and active commitments safely updated.',
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
