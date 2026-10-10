import { WorkerProfile } from '../models/WorkerProfile.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';

export const getMyWorkerProfile = async (req, res, next) => {
  try {
    let profile = await WorkerProfile.findOne({ user: req.user._id }).populate('savedJobs');
    if (!profile) {
      profile = await WorkerProfile.create({ user: req.user._id });
    }

    res.status(200).json({
      success: true,
      profile,
      user: {
        id: req.user._id,
        name: req.user.name,
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

    if (name && name.trim()) {
      await User.findByIdAndUpdate(req.user._id, { name: name.trim() });
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

    res.status(200).json({
      success: true,
      savedJobs: profile?.savedJobs || []
    });
  } catch (error) {
    next(error);
  }
};
