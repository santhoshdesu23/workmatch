import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { Attendance } from '../models/Attendance.js';
import { Report } from '../models/Report.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { AuditLog } from '../models/AuditLog.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { Setting } from '../models/Setting.js';
import { ROLES, JOB_STATUSES, APPLICATION_STATUSES, ATTENDANCE_STATUSES, ATTENDANCE_METHODS } from '../config/constants.js';

const SENSITIVE_USER_FIELDS =
  '-passwordHash -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -tokenVersion';

export function toSafeUserDTO(user) {
  if (!user) return null;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.tokenVersion;
  return obj;
}

// OWASP-compliant CSV cell sanitizer against formula injection
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

// Helper to calculate date range
function getDateRangeFilter(range, customStart, customEnd) {
  const now = new Date();
  let start;

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (range === 'all') {
    return null;
  } else if (customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { $gte: s, $lte: e };
    }
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    // Default 30 days
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { $gte: start, $lte: now };
}

// -------------------------------------------------------------
// 1. DASHBOARD & OVERVIEW
// -------------------------------------------------------------
export const getAdminDashboard = async (req, res, next) => {
  try {
    const { range = '30d', startDate, endDate } = req.query;
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const createdAtQuery = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalUsers,
      totalWorkers,
      totalEmployers,
      activeUsers,
      suspendedUsers,
      totalJobs,
      activeJobs,
      totalApplications,
      totalAssignments,
      selectedWorkers,
      openReports,
      pendingVerifications,
      totalAttendance,
      gpsAttendance,
      manualAttendance,
      recentUsers,
      recentJobs,
      recentReports,
      recentAuditLogs
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.WORKER }),
      User.countDocuments({ role: ROLES.EMPLOYER }),
      User.countDocuments({ accountStatus: 'active' }),
      User.countDocuments({ accountStatus: 'suspended' }),
      Job.countDocuments(),
      Job.countDocuments({ status: JOB_STATUSES.OPEN }),
      Application.countDocuments(),
      Assignment.countDocuments(),
      Application.countDocuments({
        status: { $in: [APPLICATION_STATUSES.ACCEPTED, APPLICATION_STATUSES.HIRED] }
      }),
      Report.countDocuments({ status: { $in: ['pending', 'investigating', 'action_required'] } }),
      VerificationRequest.countDocuments({ status: 'pending' }),
      Attendance.countDocuments(),
      Attendance.countDocuments({ method: ATTENDANCE_METHODS.GPS }),
      Attendance.countDocuments({ method: ATTENDANCE_METHODS.MANUAL }),
      User.find().select(SENSITIVE_USER_FIELDS).sort({ createdAt: -1 }).limit(6).lean(),
      Job.find().populate('employer', 'name email').sort({ createdAt: -1 }).limit(6).lean(),
      Report.find().populate('reporter', 'name email').sort({ createdAt: -1 }).limit(6).lean(),
      AuditLog.find().populate('actor', 'name email role').sort({ createdAt: -1 }).limit(8).lean()
    ]);

    // Aggregate category distribution
    const categoryStats = await Job.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // Aggregate geographic / city distribution
    const cityStats = await Job.aggregate([
      {
        $project: {
          cityName: {
            $ifNull: ['$city', { $ifNull: ['$locality', '$location.city'] }]
          }
        }
      },
      { $match: { cityName: { $exists: true, $ne: '' } } },
      { $group: { _id: '$cityName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // Aggregate User Growth Trend (by date)
    const userGrowthTrend = await User.aggregate([
      ...(dateFilter ? [{ $match: createdAtQuery }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          workers: {
            $sum: { $cond: [{ $eq: ['$role', ROLES.WORKER] }, 1, 0] }
          },
          employers: {
            $sum: { $cond: [{ $eq: ['$role', ROLES.EMPLOYER] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Aggregate Job Posting Trend (by date)
    const jobTrends = await Job.aggregate([
      ...(dateFilter ? [{ $match: createdAtQuery }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $eq: ['$status', JOB_STATUSES.OPEN] }, 1, 0] }
          },
          filled: {
            $sum: { $cond: [{ $eq: ['$status', JOB_STATUSES.FILLED] }, 1, 0] }
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$status', JOB_STATUSES.EXPIRED] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Aggregate Application Trend (by date)
    const applicationTrends = await Application.aggregate([
      ...(dateFilter ? [{ $match: createdAtQuery }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          selected: {
            $sum: {
              $cond: [
                { $in: ['$status', [APPLICATION_STATUSES.ACCEPTED, APPLICATION_STATUSES.HIRED]] },
                1,
                0
              ]
            }
          },
          rejected: {
            $sum: {
              $cond: [
                { $in: ['$status', [APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.WITHDRAWN]] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Calculate Fill Rate safely
    const fillRate =
      totalJobs > 0 && totalApplications > 0
        ? Math.round((selectedWorkers / totalApplications) * 100)
        : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalWorkers,
        totalEmployers,
        activeUsers,
        suspendedUsers,
        totalJobs,
        activeJobs,
        totalApplications,
        totalAssignments,
        selectedWorkers,
        fillRate,
        openReports,
        pendingVerifications,
        totalAttendance,
        gpsAttendance,
        manualAttendance
      },
      trends: {
        userGrowth: userGrowthTrend.map((u) => ({
          date: u._id,
          total: u.total,
          workers: u.workers,
          employers: u.employers
        })),
        jobTrends: jobTrends.map((j) => ({
          date: j._id,
          total: j.total,
          open: j.open,
          filled: j.filled,
          expired: j.expired
        })),
        applicationTrends: applicationTrends.map((a) => ({
          date: a._id,
          total: a.total,
          selected: a.selected,
          rejected: a.rejected
        }))
      },
      categoryDistribution: categoryStats.map((c) => ({
        category: c._id || 'General',
        count: c.count
      })),
      cityDistribution: cityStats.map((c) => ({
        city: c._id,
        count: c.count
      })),
      recentActivity: {
        users: recentUsers,
        jobs: recentJobs,
        reports: recentReports,
        auditLogs: recentAuditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 2. USER MANAGEMENT
// -------------------------------------------------------------
export const getAdminUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      role,
      status,
      verificationStatus,
      emailVerified,
      search,
      sort = '-createdAt'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (role) {
      filter.$or = [{ role }, { roles: role }, { activeRole: role }];
    }
    if (status) filter.accountStatus = status;
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (emailVerified !== undefined) {
      filter.emailVerified = emailVerified === 'true' || emailVerified === true;
    }
    if (search) {
      const s = String(search).trim();
      const searchRegex = { $regex: s, $options: 'i' };
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select(SENSITIVE_USER_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Attach profile brief info (e.g. worker completeness, employer business name)
    const userIds = users.map((u) => u._id);
    const [workerProfiles, employerProfiles] = await Promise.all([
      WorkerProfile.find({ user: { $in: userIds } }).lean(),
      EmployerProfile.find({ user: { $in: userIds } }).lean()
    ]);

    const workerMap = new Map(workerProfiles.map((p) => [String(p.user), p]));
    const employerMap = new Map(employerProfiles.map((p) => [String(p.user), p]));

    const enrichedUsers = users.map((u) => {
      const wp = workerMap.get(String(u._id));
      const ep = employerMap.get(String(u._id));
      return {
        ...u,
        hasWorkerProfile: Boolean(wp),
        hasEmployerProfile: Boolean(ep),
        businessName: ep?.businessName || null,
        workerSkills: wp?.skills || [],
        workerRating: wp?.rating?.average || 0,
        completedJobsCount: wp?.completedJobsCount || 0
      };
    });

    res.status(200).json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select(SENSITIVE_USER_FIELDS).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [
      workerProfile,
      employerProfile,
      recentJobs,
      recentApplications,
      recentAttendance,
      reportsAgainst,
      auditLogs
    ] = await Promise.all([
      WorkerProfile.findOne({ user: userId }).lean(),
      EmployerProfile.findOne({ user: userId }).lean(),
      Job.find({ employer: userId }).sort({ createdAt: -1 }).limit(10).lean(),
      Application.find({ worker: userId }).populate('job', 'title category grossPay payBasis').sort({ createdAt: -1 }).limit(10).lean(),
      Attendance.find({ worker: userId }).populate('job', 'title').sort({ createdAt: -1 }).limit(10).lean(),
      Report.find({ reportedUser: userId }).populate('reporter', 'name email').sort({ createdAt: -1 }).lean(),
      AuditLog.find({ resourceId: userId }).sort({ createdAt: -1 }).limit(20).lean()
    ]);

    res.status(200).json({
      success: true,
      user,
      workerProfile,
      employerProfile,
      stats: {
        totalJobsPosted: recentJobs.length,
        totalApplications: recentApplications.length,
        totalAttendance: recentAttendance.length,
        reportsCount: reportsAgainst.length
      },
      recentJobs,
      recentApplications,
      recentAttendance,
      reportsAgainst,
      auditLogs
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = ['active', 'suspended', 'pending'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory moderation reason must be provided.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(400).json({
        success: false,
        message: 'Deleted accounts cannot be reactivated.'
      });
    }

    const prevStatus = user.accountStatus;
    user.accountStatus = status;
    await user.save();

    await AuditLog.create({
      actor: req.user._id,
      action: status === 'suspended' ? 'SUSPEND_USER' : 'REACTIVATE_USER',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { previousStatus: prevStatus, newStatus: status, reason: String(reason).trim() },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: `User status changed to ${status}.`,
      user: toSafeUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// Dedicated Worker Management list
export const getAdminWorkers = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search, skill, verificationStatus, location } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const userFilter = {
      $or: [{ role: ROLES.WORKER }, { roles: ROLES.WORKER }]
    };
    if (verificationStatus) userFilter.verificationStatus = verificationStatus;
    if (search) {
      const s = String(search).trim();
      userFilter.$or = [{ name: { $regex: s, $options: 'i' } }, { email: { $regex: s, $options: 'i' } }];
    }

    const workers = await User.find(userFilter)
      .select(SENSITIVE_USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await User.countDocuments(userFilter);
    const userIds = workers.map((w) => w._id);
    const profiles = await WorkerProfile.find({ user: { $in: userIds } }).lean();
    const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

    const enriched = workers.map((w) => {
      const p = profileMap.get(String(w._id));
      return {
        ...w,
        profile: p || null,
        skills: p?.skills || [],
        preferredLocationName: p?.preferredLocationName || 'Not specified',
        rating: p?.rating?.average || 0,
        completedJobsCount: p?.completedJobsCount || 0
      };
    });

    res.status(200).json({
      success: true,
      workers: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Dedicated Employer Management list
export const getAdminEmployers = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search, verificationStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const userFilter = {
      $or: [{ role: ROLES.EMPLOYER }, { roles: ROLES.EMPLOYER }]
    };
    if (verificationStatus) userFilter.verificationStatus = verificationStatus;
    if (search) {
      const s = String(search).trim();
      userFilter.$or = [{ name: { $regex: s, $options: 'i' } }, { email: { $regex: s, $options: 'i' } }];
    }

    const employers = await User.find(userFilter)
      .select(SENSITIVE_USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await User.countDocuments(userFilter);
    const userIds = employers.map((e) => e._id);

    const [profiles, jobCounts] = await Promise.all([
      EmployerProfile.find({ user: { $in: userIds } }).lean(),
      Job.aggregate([
        { $match: { employer: { $in: userIds } } },
        { $group: { _id: '$employer', count: { $sum: 1 } } }
      ])
    ]);

    const profileMap = new Map(profiles.map((p) => [String(p.user), p]));
    const jobMap = new Map(jobCounts.map((j) => [String(j._id), j.count]));

    const enriched = employers.map((e) => {
      const p = profileMap.get(String(e._id));
      return {
        ...e,
        profile: p || null,
        businessName: p?.businessName || e.name,
        businessAddress: p?.businessAddress || 'Not specified',
        totalJobsPosted: jobMap.get(String(e._id)) || 0,
        rating: p?.rating?.average || 0
      };
    });

    res.status(200).json({
      success: true,
      employers: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 3. JOB MANAGEMENT & MODERATION
// -------------------------------------------------------------
export const getAdminJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      search,
      status,
      category,
      city,
      paymentBasis,
      sort = '-createdAt'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (paymentBasis) filter.payBasis = paymentBasis;
    if (city) filter['location.city'] = { $regex: city, $options: 'i' };
    if (search) {
      const s = String(search).trim();
      filter.$or = [{ title: { $regex: s, $options: 'i' } }, { description: { $regex: s, $options: 'i' } }];
    }

    const [jobs, totalCount] = await Promise.all([
      Job.find(filter)
        .populate('employer', 'name email verificationStatus')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter)
    ]);

    // Attach application counts for each job
    const jobIds = jobs.map((j) => j._id);
    const appCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    const appMap = new Map(appCounts.map((a) => [String(a._id), a.count]));

    const enrichedJobs = jobs.map((j) => ({
      ...j,
      totalApplications: appMap.get(String(j._id)) || 0,
      fillRate: j.openings > 0 ? Math.min(100, Math.round(((j.filledCount || 0) / j.openings) * 100)) : 0
    }));

    res.status(200).json({
      success: true,
      jobs: enrichedJobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminJobDetails = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId)
      .populate('employer', 'name email verificationStatus accountStatus')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const [applications, attendanceRecords, reports, auditLogs] = await Promise.all([
      Application.find({ job: jobId })
        .populate('worker', 'name email verificationStatus')
        .sort({ createdAt: -1 })
        .lean(),
      Attendance.find({ job: jobId })
        .populate('worker', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      Report.find({ reportedJob: jobId })
        .populate('reporter', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      AuditLog.find({ resourceId: jobId }).sort({ createdAt: -1 }).lean()
    ]);

    res.status(200).json({
      success: true,
      job,
      applications,
      attendanceRecords,
      reports,
      auditLogs
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = [
      JOB_STATUSES.OPEN,
      JOB_STATUSES.FILLED,
      JOB_STATUSES.CANCELLED,
      JOB_STATUSES.EXPIRED,
      'SUSPENDED'
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid job status: "${status}". Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory moderation reason must be provided.'
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const prevStatus = job.status;
    job.status = status;
    await job.save();

    await AuditLog.create({
      actor: req.user._id,
      action: status === 'SUSPENDED' ? 'SUSPEND_JOB' : 'UPDATE_JOB_STATUS',
      resourceType: 'Job',
      resourceId: job._id,
      metadata: { previousStatus: prevStatus, newStatus: status, reason: String(reason).trim() },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: `Job status updated to ${status}.`,
      job
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 4. APPLICATIONS & RECRUITMENT MONITORING
// -------------------------------------------------------------
export const getAdminApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, jobId, workerId, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (jobId) filter.job = jobId;
    if (workerId) filter.worker = workerId;

    const [applications, totalCount, statusStats] = await Promise.all([
      Application.find(filter)
        .populate('worker', 'name email verificationStatus')
        .populate('job', 'title category openings filledCount grossPay payBasis workStartDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Application.countDocuments(filter),
      Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const statsMap = Object.fromEntries(statusStats.map((s) => [s._id, s.count]));

    res.status(200).json({
      success: true,
      applications,
      stats: {
        total: Object.values(statsMap).reduce((a, b) => a + b, 0),
        applied: statsMap[APPLICATION_STATUSES.APPLIED] || 0,
        shortlisted: statsMap[APPLICATION_STATUSES.SHORTLISTED] || 0,
        accepted: statsMap[APPLICATION_STATUSES.ACCEPTED] || 0,
        hired: statsMap[APPLICATION_STATUSES.HIRED] || 0,
        rejected: statsMap[APPLICATION_STATUSES.REJECTED] || 0,
        withdrawn: statsMap[APPLICATION_STATUSES.WITHDRAWN] || 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminRecruitmentAnalytics = async (req, res, next) => {
  try {
    const [byCategory, byCity, topApplicantJobs, fillRateOverview] = await Promise.all([
      Application.aggregate([
        {
          $lookup: {
            from: 'jobs',
            localField: 'job',
            foreignField: '_id',
            as: 'jobData'
          }
        },
        { $unwind: '$jobData' },
        { $group: { _id: '$jobData.category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      Application.aggregate([
        {
          $lookup: {
            from: 'jobs',
            localField: 'job',
            foreignField: '_id',
            as: 'jobData'
          }
        },
        { $unwind: '$jobData' },
        { $match: { 'jobData.location.city': { $exists: true, $ne: '' } } },
        { $group: { _id: '$jobData.location.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      Job.aggregate([
        {
          $lookup: {
            from: 'applications',
            localField: '_id',
            foreignField: 'job',
            as: 'apps'
          }
        },
        {
          $project: {
            title: 1,
            category: 1,
            openings: 1,
            filledCount: 1,
            applicantCount: { $size: '$apps' }
          }
        },
        { $sort: { applicantCount: -1 } },
        { $limit: 5 }
      ]),
      Job.aggregate([
        { $match: { openings: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalOpenings: { $sum: '$openings' },
            totalFilled: { $sum: '$filledCount' }
          }
        }
      ])
    ]);

    const totalOpenings = fillRateOverview[0]?.totalOpenings || 0;
    const totalFilled = fillRateOverview[0]?.totalFilled || 0;
    const overallFillRate =
      totalOpenings > 0 ? Math.round((totalFilled / totalOpenings) * 100) : 0;

    res.status(200).json({
      success: true,
      analytics: {
        byCategory: byCategory.map((c) => ({ category: c._id || 'General', count: c.count })),
        byCity: byCity.map((c) => ({ city: c._id, count: c.count })),
        topApplicantJobs,
        overallFillRate,
        totalOpenings,
        totalFilled
      }
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 5. ATTENDANCE MONITORING
// -------------------------------------------------------------
export const getAdminAttendance = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, method, jobId, workerId, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (jobId) filter.job = jobId;
    if (workerId) filter.worker = workerId;

    const [attendanceRecords, totalCount, statsAgg] = await Promise.all([
      Attendance.find(filter)
        .populate('worker', 'name email')
        .populate('employer', 'name email')
        .populate('job', 'title category location workStartDate workStartTime workEndTime')
        .populate('auditHistory.changedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Attendance.countDocuments(filter),
      Attendance.aggregate([
        {
          $group: {
            _id: { status: '$status', method: '$method' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    let gpsVerified = 0;
    let manualMarked = 0;
    let pendingCount = 0;
    let absentCount = 0;

    statsAgg.forEach((item) => {
      if (item._id.method === ATTENDANCE_METHODS.GPS) gpsVerified += item.count;
      if (item._id.method === ATTENDANCE_METHODS.MANUAL) manualMarked += item.count;
      if (item._id.status === ATTENDANCE_STATUSES.PENDING) pendingCount += item.count;
      if (item._id.status === ATTENDANCE_STATUSES.ABSENT) absentCount += item.count;
    });

    res.status(200).json({
      success: true,
      attendance: attendanceRecords,
      stats: {
        total: totalCount,
        gpsVerified,
        manualMarked,
        pendingCount,
        absentCount
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const correctAdminAttendance = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Attendance status is required.'
      });
    }

    const s = String(status).trim().toLowerCase();
    let normalizedStatus;
    if (s === 'present' || s === 'present_manual') normalizedStatus = ATTENDANCE_STATUSES.PRESENT_MANUAL;
    else if (s === 'present_gps') normalizedStatus = ATTENDANCE_STATUSES.PRESENT_GPS;
    else if (s === 'absent' || s === 'absent_manual') normalizedStatus = ATTENDANCE_STATUSES.ABSENT_MANUAL;
    else if (s === 'pending') normalizedStatus = ATTENDANCE_STATUSES.PENDING;
    else {
      return res.status(400).json({
        success: false,
        message: `Invalid attendance status: "${status}".`
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory justification reason must be recorded for administrative attendance corrections.'
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const prevStatus = attendance.status;
    attendance.status = normalizedStatus;
    attendance.markedBy = req.user._id;

    // Append to audit history
    attendance.auditHistory.push({
      action: 'CORRECTION',
      previousStatus: prevStatus,
      newStatus: normalizedStatus,
      changedBy: req.user._id,
      reason: String(reason).trim(),
      changedAt: new Date(),
      metadata: { adminCorrection: true }
    });

    await attendance.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'CORRECT_ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: attendance._id,
      metadata: {
        job: attendance.job,
        worker: attendance.worker,
        previousStatus: prevStatus,
        newStatus: normalizedStatus,
        reason: String(reason).trim()
      },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: `Attendance corrected to ${normalizedStatus}.`,
      attendance
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 6. VERIFICATION MANAGEMENT
// -------------------------------------------------------------
export const getAdminVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, type, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.verificationType = type;

    const [verifications, totalCount, pendingCount] = await Promise.all([
      VerificationRequest.find(filter)
        .populate('user', 'name email role verificationStatus')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VerificationRequest.countDocuments(filter),
      VerificationRequest.countDocuments({ status: 'pending' })
    ]);

    res.status(200).json({
      success: true,
      verifications,
      stats: {
        total: totalCount,
        pending: pendingCount
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const reviewAdminVerification = async (req, res, next) => {
  try {
    const { verificationId } = req.params;
    const { status, reviewNotes } = req.body; // status: 'approved' | 'rejected'

    const allowedStatuses = ['approved', 'rejected'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid verification status: "${status}". Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    if (status === 'rejected' && (!reviewNotes || !String(reviewNotes).trim())) {
      return res.status(400).json({
        success: false,
        message: 'A reason must be provided when rejecting a verification request.'
      });
    }

    const vReq = await VerificationRequest.findById(verificationId);
    if (!vReq) {
      return res.status(404).json({ success: false, message: 'Verification request not found.' });
    }

    vReq.status = status;
    vReq.reviewNotes = String(reviewNotes || '').trim().slice(0, 2000);
    vReq.reviewedBy = req.user._id;
    vReq.reviewedAt = new Date();
    await vReq.save();

    const newVerificationStatus = status === 'approved' ? 'verified' : 'rejected';
    await User.findByIdAndUpdate(vReq.user, { verificationStatus: newVerificationStatus });

    await EmployerProfile.findOneAndUpdate(
      { user: vReq.user },
      { verificationStatus: newVerificationStatus }
    );
    await WorkerProfile.findOneAndUpdate(
      { user: vReq.user },
      { verificationStatus: newVerificationStatus }
    );

    await AuditLog.create({
      actor: req.user._id,
      action: 'REVIEW_VERIFICATION',
      resourceType: 'VerificationRequest',
      resourceId: vReq._id,
      metadata: { targetUser: vReq.user, status, reviewNotes: vReq.reviewNotes },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: `Verification request marked as ${status}.`,
      verification: vReq
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 7. REPORTS & COMPLAINTS (TRUST & SAFETY)
// -------------------------------------------------------------
export const getAdminReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, category, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [reports, totalCount, statusCounts] = await Promise.all([
      Report.find(filter)
        .populate('reporter', 'name email')
        .populate('reportedUser', 'name email role accountStatus')
        .populate('reportedJob', 'title category grossPay payBasis')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Report.countDocuments(filter),
      Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const countsMap = Object.fromEntries(statusCounts.map((c) => [c._id, c.count]));

    res.status(200).json({
      success: true,
      reports,
      stats: {
        total: totalCount,
        pending: countsMap['pending'] || 0,
        investigating: countsMap['investigating'] || 0,
        actionRequired: countsMap['action_required'] || 0,
        resolved: countsMap['resolved'] || 0,
        dismissed: countsMap['dismissed'] || 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminReportDetails = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findById(reportId)
      .populate('reporter', 'name email role verificationStatus')
      .populate('reportedUser', 'name email role accountStatus verificationStatus')
      .populate('reportedJob')
      .populate('resolvedBy', 'name email')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const auditHistory = await AuditLog.find({ resourceId: reportId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      report,
      auditHistory
    });
  } catch (error) {
    next(error);
  }
};

export const resolveAdminReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { status, resolutionNotes, substantiated } = req.body;

    const allowedReportStatuses = ['pending', 'investigating', 'action_required', 'resolved', 'dismissed'];
    if (status && !allowedReportStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report status: "${status}". Allowed: ${allowedReportStatuses.join(', ')}`
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const previousStatus = report.status;
    const previousSubstantiated = report.substantiated;

    if (status) {
      report.status = status;
    }
    if (substantiated !== undefined) {
      report.substantiated = Boolean(substantiated);
    } else if (status === 'resolved' && report.substantiated === undefined) {
      report.substantiated = false;
    }

    if (resolutionNotes !== undefined) {
      report.resolutionNotes = String(resolutionNotes).trim().slice(0, 2000);
    }
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    await report.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'RESOLVE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      metadata: {
        previousStatus,
        newStatus: report.status,
        previousSubstantiated,
        newSubstantiated: report.substantiated,
        reportedUser: report.reportedUser,
        reportedJob: report.reportedJob,
        resolutionNotes: report.resolutionNotes
      },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: 'Report resolved and administrative audit trail recorded.',
      report
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 8. ADVANCED ANALYTICS & CSV EXPORT
// -------------------------------------------------------------
export const getAdminAnalytics = async (req, res, next) => {
  try {
    const { range = '30d', startDate, endDate } = req.query;
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const createdAtQuery = dateFilter ? { createdAt: dateFilter } : {};

    const [
      userStats,
      jobCategoryStats,
      jobCityStats,
      applicationFunnel,
      attendanceOverview
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$accountStatus', 'active'] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $eq: ['$accountStatus', 'suspended'] }, 1, 0] } },
            verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] } }
          }
        }
      ]),
      Job.aggregate([
        ...(dateFilter ? [{ $match: createdAtQuery }] : []),
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Job.aggregate([
        ...(dateFilter ? [{ $match: createdAtQuery }] : []),
        { $match: { 'location.city': { $exists: true, $ne: '' } } },
        { $group: { _id: '$location.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Application.aggregate([
        ...(dateFilter ? [{ $match: createdAtQuery }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        ...(dateFilter ? [{ $match: createdAtQuery }] : []),
        {
          $group: {
            _id: '$method',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        users: userStats,
        jobCategories: jobCategoryStats,
        jobCities: jobCityStats,
        applicationFunnel: Object.fromEntries(applicationFunnel.map((a) => [a._id, a.count])),
        attendanceOverview: Object.fromEntries(attendanceOverview.map((a) => [a._id || 'UNSPECIFIED', a.count]))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const exportAdminCSV = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const allowedResources = ['users', 'jobs', 'applications', 'attendance', 'reports', 'audit-logs'];

    if (!allowedResources.includes(resource)) {
      return res.status(400).json({
        success: false,
        message: `Invalid export resource: "${resource}". Allowed: ${allowedResources.join(', ')}`
      });
    }

    let csvContent = '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (resource === 'users') {
      const users = await User.find().select(SENSITIVE_USER_FIELDS).sort({ createdAt: -1 }).lean();
      const headers = ['ID', 'Name', 'Email', 'Role', 'Account Status', 'Verification Status', 'Email Verified', 'Created At'];
      const rows = users.map((u) => [
        sanitizeCsvCell(u._id),
        sanitizeCsvCell(u.name),
        sanitizeCsvCell(u.email),
        sanitizeCsvCell(u.role),
        sanitizeCsvCell(u.accountStatus),
        sanitizeCsvCell(u.verificationStatus),
        sanitizeCsvCell(u.emailVerified),
        sanitizeCsvCell(u.createdAt ? new Date(u.createdAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (resource === 'jobs') {
      const jobs = await Job.find().populate('employer', 'name email').sort({ createdAt: -1 }).lean();
      const headers = ['ID', 'Title', 'Category', 'Employer', 'Status', 'Gross Pay', 'Pay Basis', 'City', 'Openings', 'Filled', 'Created At'];
      const rows = jobs.map((j) => [
        sanitizeCsvCell(j._id),
        sanitizeCsvCell(j.title),
        sanitizeCsvCell(j.category),
        sanitizeCsvCell(j.employer?.name || j.employer?.email || 'N/A'),
        sanitizeCsvCell(j.status),
        sanitizeCsvCell(j.grossPay),
        sanitizeCsvCell(j.payBasis),
        sanitizeCsvCell(j.location?.city || 'N/A'),
        sanitizeCsvCell(j.openings),
        sanitizeCsvCell(j.filledCount),
        sanitizeCsvCell(j.createdAt ? new Date(j.createdAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (resource === 'applications') {
      const apps = await Application.find()
        .populate('worker', 'name email')
        .populate('job', 'title category')
        .sort({ createdAt: -1 })
        .lean();
      const headers = ['ID', 'Job Title', 'Category', 'Worker Name', 'Worker Email', 'Status', 'Applied At'];
      const rows = apps.map((a) => [
        sanitizeCsvCell(a._id),
        sanitizeCsvCell(a.job?.title || 'N/A'),
        sanitizeCsvCell(a.job?.category || 'N/A'),
        sanitizeCsvCell(a.worker?.name || 'N/A'),
        sanitizeCsvCell(a.worker?.email || 'N/A'),
        sanitizeCsvCell(a.status),
        sanitizeCsvCell(a.createdAt ? new Date(a.createdAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (resource === 'attendance') {
      const attendance = await Attendance.find()
        .populate('worker', 'name email')
        .populate('job', 'title')
        .sort({ createdAt: -1 })
        .lean();
      const headers = ['ID', 'Job Title', 'Worker Name', 'Status', 'Method', 'Distance (m)', 'Accuracy (m)', 'Checked In At'];
      const rows = attendance.map((at) => [
        sanitizeCsvCell(at._id),
        sanitizeCsvCell(at.job?.title || 'N/A'),
        sanitizeCsvCell(at.worker?.name || 'N/A'),
        sanitizeCsvCell(at.status),
        sanitizeCsvCell(at.method || 'UNSPECIFIED'),
        sanitizeCsvCell(at.distanceMeters || '0'),
        sanitizeCsvCell(at.accuracyMeters || '0'),
        sanitizeCsvCell(at.checkedInAt ? new Date(at.checkedInAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (resource === 'reports') {
      const reports = await Report.find()
        .populate('reporter', 'name email')
        .populate('reportedUser', 'name email')
        .populate('reportedJob', 'title')
        .sort({ createdAt: -1 })
        .lean();
      const headers = ['ID', 'Category', 'Reporter', 'Reported User', 'Reported Job', 'Status', 'Substantiated', 'Created At'];
      const rows = reports.map((r) => [
        sanitizeCsvCell(r._id),
        sanitizeCsvCell(r.category),
        sanitizeCsvCell(r.reporter?.email || 'N/A'),
        sanitizeCsvCell(r.reportedUser?.email || 'N/A'),
        sanitizeCsvCell(r.reportedJob?.title || 'N/A'),
        sanitizeCsvCell(r.status),
        sanitizeCsvCell(r.substantiated),
        sanitizeCsvCell(r.createdAt ? new Date(r.createdAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (resource === 'audit-logs') {
      const logs = await AuditLog.find().populate('actor', 'name email role').sort({ createdAt: -1 }).limit(1000).lean();
      const headers = ['ID', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'Timestamp'];
      const rows = logs.map((l) => [
        sanitizeCsvCell(l._id),
        sanitizeCsvCell(l.actor?.email || l.actor?.name || 'System'),
        sanitizeCsvCell(l.action),
        sanitizeCsvCell(l.resourceType),
        sanitizeCsvCell(l.resourceId || 'N/A'),
        sanitizeCsvCell(l.createdAt ? new Date(l.createdAt).toISOString() : '')
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=workmatch-${resource}-${timestamp}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 9. ADMIN ACTIVITY LOGS (AUDIT TRAIL)
// -------------------------------------------------------------
export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, actor, action, resourceType, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (actor) filter.actor = actor;
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      auditLogs: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// 10. ADMIN PLATFORM SETTINGS
// -------------------------------------------------------------
export const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find().populate('updatedBy', 'name email').lean();

    // Default configuration template if not yet initialized in DB
    const defaults = {
      allowedCategories: [
        'Catering and Events',
        'Hospitality & Waitstaff',
        'Retail & Cashier',
        'Warehouse & Packing',
        'Delivery & Logistics',
        'Cleaning & Maintenance',
        'Promotions & Brand Ambassadors'
      ],
      moderationRules: {
        autoFlagExcessivePay: true,
        maxHourlyRateINR: 5000,
        maxPerShiftRateINR: 20000,
        requireJobApproval: false
      },
      attendanceConfig: {
        maxGeofenceMeters: 200,
        allowEmployerManualMarking: true
      },
      platformBanner: {
        enabled: false,
        message: '',
        type: 'info'
      }
    };

    const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const merged = { ...defaults, ...settingMap };

    res.status(200).json({
      success: true,
      settings: merged,
      rawSettings: settings
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSetting = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Setting key and value are required.'
      });
    }

    const prevSetting = await Setting.findOne({ key });
    const setting = await Setting.findOneAndUpdate(
      { key },
      {
        value,
        description: description || prevSetting?.description || '',
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      actor: req.user._id,
      action: 'UPDATE_SETTING',
      resourceType: 'Setting',
      metadata: {
        key,
        previousValue: prevSetting?.value,
        newValue: value
      },
      ipAddress: req.ip || ''
    });

    res.status(200).json({
      success: true,
      message: `Setting "${key}" updated successfully.`,
      setting
    });
  } catch (error) {
    next(error);
  }
};
