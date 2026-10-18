import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { Report } from '../models/Report.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { AuditLog } from '../models/AuditLog.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ROLES, JOB_STATUSES, ASSIGNMENT_STATUSES } from '../config/constants.js';

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

export const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalWorkers,
      totalEmployers,
      totalJobs,
      activeJobs,
      totalApplications,
      totalAssignments,
      completedAssignments,
      openReports,
      pendingVerifications,
      recentUsers,
      recentReports
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.WORKER }),
      User.countDocuments({ role: ROLES.EMPLOYER }),
      Job.countDocuments(),
      Job.countDocuments({ status: JOB_STATUSES.OPEN }),
      Application.countDocuments(),
      Assignment.countDocuments(),
      Assignment.countDocuments({ status: ASSIGNMENT_STATUSES.COMPLETED }),
      Report.countDocuments({ status: 'pending' }),
      VerificationRequest.countDocuments({ status: 'pending' }),
      User.find().select(SENSITIVE_USER_FIELDS).sort({ createdAt: -1 }).limit(8).lean(),
      Report.find().populate('reporter', 'name email').sort({ createdAt: -1 }).limit(6).lean()
    ]);

    const completionRate =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalWorkers,
        totalEmployers,
        totalJobs,
        activeJobs,
        totalApplications,
        totalAssignments,
        completedAssignments,
        completionRate,
        openReports,
        pendingVerifications
      },
      recentUsers,
      recentReports
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.accountStatus = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select(SENSITIVE_USER_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason = '' } = req.body;

    const allowedStatuses = ['active', 'suspended', 'pending'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const prevStatus = user.accountStatus;
    user.accountStatus = status;
    await user.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'UPDATE_USER_STATUS',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { previousStatus: prevStatus, newStatus: status, reason }
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

export const getAdminJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find()
      .populate('employer', 'name email verificationStatus')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      jobs
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminReports = async (req, res, next) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'name email')
      .populate('reportedUser', 'name email')
      .populate('reportedJob', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      reports
    });
  } catch (error) {
    next(error);
  }
};

export const resolveAdminReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { status, resolutionNotes, substantiated } = req.body;

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
      report.resolutionNotes = String(resolutionNotes);
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
      }
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

export const getAdminVerifications = async (req, res, next) => {
  try {
    const verifications = await VerificationRequest.find()
      .populate('user', 'name email role verificationStatus')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      verifications
    });
  } catch (error) {
    next(error);
  }
};

export const reviewAdminVerification = async (req, res, next) => {
  try {
    const { verificationId } = req.params;
    const { status, reviewNotes } = req.body; // status: 'approved' | 'rejected'

    const vReq = await VerificationRequest.findById(verificationId);
    if (!vReq) {
      return res.status(404).json({ success: false, message: 'Verification request not found.' });
    }

    vReq.status = status;
    vReq.reviewNotes = reviewNotes || '';
    vReq.reviewedBy = req.user._id;
    vReq.reviewedAt = new Date();
    await vReq.save();

    const newVerificationStatus = status === 'approved' ? 'verified' : 'rejected';
    await User.findByIdAndUpdate(vReq.user, { verificationStatus: newVerificationStatus });

    // Also update profile
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
      metadata: { targetUser: vReq.user, status }
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
