import { EmployerProfile } from '../models/EmployerProfile.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { User } from '../models/User.js';
import { JOB_STATUSES, APPLICATION_STATUSES, ASSIGNMENT_STATUSES, PAYMENT_STATUSES } from '../config/constants.js';
import { computeEmployerReliability } from '../services/reliabilityService.js';
import { validateNameField } from '../utils/nameValidator.js';

export const getMyEmployerProfile = async (req, res, next) => {
  try {
    let profile = await EmployerProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await EmployerProfile.create({
        user: req.user._id,
        businessName: `${req.user.name}'s Organization`
      });
    }

    const nameParts = (req.user.name || '').trim().split(/\s+/);
    const firstName = req.user.firstName || nameParts[0] || '';
    const lastName = req.user.lastName || nameParts.slice(1).join(' ') || '';

    res.status(200).json({
      success: true,
      profile,
      user: {
        id: req.user._id,
        name: req.user.name,
        firstName,
        lastName,
        email: req.user.email,
        verificationStatus: req.user.verificationStatus,
        emailVerified: req.user.emailVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyEmployerProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      name,
      businessName,
      description,
      businessCategory,
      businessAddress,
      coordinates, // [lng, lat]
      publicContact
    } = req.body;

    if (firstName !== undefined || lastName !== undefined) {
      if (firstName !== undefined) {
        const firstError = validateNameField(firstName, 'First name');
        if (firstError) {
          return res.status(400).json({ success: false, message: firstError });
        }
      }
      if (lastName !== undefined) {
        const lastError = validateNameField(lastName, 'Last name');
        if (lastError) {
          return res.status(400).json({ success: false, message: lastError });
        }
      }

      const currentUser = await User.findById(req.user._id);
      const currentFirst = currentUser.firstName || (currentUser.name ? currentUser.name.split(/\s+/)[0] : '');
      const currentLast = currentUser.lastName || (currentUser.name ? currentUser.name.split(/\s+/).slice(1).join(' ') : '');

      const newFirst = firstName !== undefined ? firstName.trim() : currentFirst;
      const newLast = lastName !== undefined ? lastName.trim() : currentLast;
      const finalName = `${newFirst} ${newLast}`.trim();

      await User.findByIdAndUpdate(req.user._id, {
        firstName: newFirst,
        lastName: newLast,
        name: finalName
      });
    } else if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      }
      const trimmed = name.trim();
      if (trimmed.length > 100) {
        return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters.' });
      }
      const parts = trimmed.split(/\s+/);
      const first = parts[0]?.slice(0, 30) || '';
      const last = parts.slice(1).join(' ')?.slice(0, 30) || '';
      await User.findByIdAndUpdate(req.user._id, {
        name: trimmed,
        firstName: first,
        lastName: last
      });
    }

    const updates = {};
    if (businessName !== undefined) updates.businessName = businessName;
    if (description !== undefined) updates.description = description;
    if (businessCategory !== undefined) updates.businessCategory = businessCategory;
    if (businessAddress !== undefined) updates.businessAddress = businessAddress;
    if (coordinates && coordinates.length === 2) {
      updates.location = { type: 'Point', coordinates };
    }
    if (publicContact !== undefined) updates.publicContact = publicContact;

    const profile = await EmployerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Employer profile updated successfully.',
      profile
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployerJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ employer: req.user._id })
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

export const getEmployerDashboard = async (req, res, next) => {
  try {
    const employerId = req.user._id;

    // Compute live metrics from verified database records
    const [
      activeJobsCount,
      allJobs,
      totalApplicationsCount,
      shortlistedCount,
      confirmedAssignmentsCount,
      pendingPaymentsCount,
      recentApplications
    ] = await Promise.all([
      Job.countDocuments({ employer: employerId, status: JOB_STATUSES.OPEN }),
      Job.find({ employer: employerId }).select('_id title status workDate grossPay openings filledCount').lean(),
      Application.countDocuments({
        job: { $in: await Job.find({ employer: employerId }).distinct('_id') }
      }),
      Application.countDocuments({
        job: { $in: await Job.find({ employer: employerId }).distinct('_id') },
        status: APPLICATION_STATUSES.SHORTLISTED
      }),
      Assignment.countDocuments({
        employer: employerId,
        status: { $in: [ASSIGNMENT_STATUSES.CONFIRMED, ASSIGNMENT_STATUSES.IN_PROGRESS] }
      }),
      PaymentRecord.countDocuments({
        employer: employerId,
        status: { $in: [PAYMENT_STATUSES.DUE, PAYMENT_STATUSES.PROCESSING] }
      }),
      Application.find({
        job: { $in: await Job.find({ employer: employerId }).distinct('_id') }
      })
        .populate('worker', 'name email')
        .populate('job', 'title workDate grossPay')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
    ]);

    res.status(200).json({
      success: true,
      metrics: {
        activeJobsCount,
        totalJobsCount: allJobs.length,
        totalApplicationsCount,
        shortlistedCount,
        confirmedAssignmentsCount,
        pendingPaymentsCount
      },
      jobs: allJobs,
      recentApplications
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployerReliabilityHandler = async (req, res, next) => {
  try {
    const { employerId } = req.params;
    const reliability = await computeEmployerReliability(employerId);
    if (!reliability) {
      return res.status(404).json({ success: false, message: 'Employer record not found.' });
    }
    res.status(200).json({ success: true, reliability });
  } catch (error) {
    next(error);
  }
};

