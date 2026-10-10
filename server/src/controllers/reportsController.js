import { Report } from '../models/Report.js';

export const createReport = async (req, res, next) => {
  try {
    const { reportedUser, reportedJob, category, description } = req.body;
    const reporterId = req.user._id;

    if (!category || !description) {
      return res.status(400).json({ success: false, message: 'Category and description are required.' });
    }

    const report = await Report.create({
      reporter: reporterId,
      reportedUser: reportedUser || null,
      reportedJob: reportedJob || null,
      category,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted to trust and safety moderation for review.',
      report
    });
  } catch (error) {
    next(error);
  }
};
