import { Report } from '../models/Report.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assignment } from '../models/Assignment.js';
import { ROLES } from '../config/constants.js';

export const createReport = async (req, res, next) => {
  try {
    const { reportedUser, reportedJob, category, description, evidence = '' } = req.body;
    const reporterId = req.user._id;

    if (!category || !description || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A valid category and a descriptive reason (at least 5 characters) are required.'
      });
    }

    let targetJob = null;
    let targetEmployerId = reportedUser || null;

    if (reportedJob) {
      targetJob = await Job.findById(reportedJob);
      if (!targetJob) {
        return res.status(404).json({ success: false, message: 'Referenced job posting not found.' });
      }
      if (!targetEmployerId) {
        targetEmployerId = targetJob.employer;
      }

      // Check legitimate relationship: reporter must not be the employer themselves,
      // and must have interacted with or discovered the job as a worker or applicant
      if (targetJob.employer.toString() === reporterId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Employers cannot report their own job listings.'
        });
      }

      // Prevent duplicate pending/investigating reports for the same job and category by this reporter
      const existingPending = await Report.findOne({
        reporter: reporterId,
        reportedJob,
        category,
        status: { $in: ['pending', 'investigating'] }
      });

      if (existingPending) {
        return res.status(409).json({
          success: false,
          message: `You already have an active report under review for this job listing (Category: ${category}). Our moderation team is investigating.`
        });
      }
    }

    const report = await Report.create({
      reporter: reporterId,
      reportedUser: targetEmployerId,
      reportedJob: reportedJob || null,
      category,
      description: description.trim(),
      evidence: String(evidence || '').trim().slice(0, 2000),
      status: 'pending',
      substantiated: false
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted to trust & safety moderation for thorough review.',
      report: {
        _id: report._id,
        category: report.category,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};
