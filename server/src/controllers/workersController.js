import { WorkerProfile } from '../models/WorkerProfile.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { validateNameField } from '../utils/nameValidator.js';
import {
  isJobApplicationDeadlinePassed,
  isJobWorkEnded,
  isJobWorkOngoing,
  getEffectiveJobStatus
} from '../utils/scheduleUtils.js';

export const getMyWorkerProfile = async (req, res, next) => {
  try {
    let profile = await WorkerProfile.findOne({ user: req.user._id }).populate('savedJobs');
    if (!profile) {
      profile = await WorkerProfile.create({ user: req.user._id });
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
        emailVerified: req.user.emailVerified,
        verificationStatus: req.user.verificationStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyWorkerProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      name,
      bio,
      skills,
      experienceSummary,
      preferredCategories,
      preferredLocationName,
      coordinates, // [lng, lat]
      travelRadiusKm,
      expectedPay,
      languages
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
    if (bio !== undefined) updates.bio = bio;
    if (skills !== undefined) {
      updates.skills = Array.isArray(skills) ? skills : skills.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (experienceSummary !== undefined) updates.experienceSummary = experienceSummary;
    if (preferredCategories !== undefined) updates.preferredCategories = preferredCategories;
    if (preferredLocationName !== undefined) updates.preferredLocationName = preferredLocationName;
    if (coordinates && coordinates.length === 2) {
      updates.location = { type: 'Point', coordinates };
    }
    if (travelRadiusKm !== undefined) updates.travelRadiusKm = Number(travelRadiusKm);
    if (expectedPay !== undefined) updates.expectedPay = expectedPay;
    if (languages !== undefined) updates.languages = languages;

    const profile = await WorkerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Worker profile updated successfully.',
      profile
    });
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable, days, timeSlots } = req.body;
    const profile = await WorkerProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    if (isAvailable !== undefined) profile.availability.isAvailable = Boolean(isAvailable);
    if (days !== undefined) profile.availability.days = days;
    if (timeSlots !== undefined) profile.availability.timeSlots = timeSlots;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully.',
      availability: profile.availability
    });
  } catch (error) {
    next(error);
  }
};

export const getSavedJobs = async (req, res, next) => {
  try {
    const profile = await WorkerProfile.findOne({ user: req.user._id }).populate({
      path: 'savedJobs',
      populate: { path: 'employer', select: 'name email' }
    });

    const now = new Date();
    const rawSaved = profile?.savedJobs || [];
    const savedJobs = rawSaved
      .filter((j) => j && typeof j === 'object')
      .map((job) => {
        const leanJob = typeof job.toObject === 'function' ? job.toObject() : job;
        return {
          ...leanJob,
          isDeadlinePassed: isJobApplicationDeadlinePassed(leanJob, now),
          isWorkEnded: isJobWorkEnded(leanJob, now),
          isWorkOngoing: isJobWorkOngoing(leanJob, now),
          effectiveStatus: getEffectiveJobStatus(leanJob, now)
        };
      });

    res.status(200).json({
      success: true,
      savedJobs
    });
  } catch (error) {
    next(error);
  }
};
