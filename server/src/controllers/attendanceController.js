import { Attendance } from '../models/Attendance.js';
import { Job } from '../models/Job.js';
import { Assignment } from '../models/Assignment.js';
import { User } from '../models/User.js';
import {
  ROLES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  ATTENDANCE_METHODS,
  ATTENDANCE_RADIUS_METERS
} from '../config/constants.js';
import { calculateDistanceKmPrecise } from '../services/matchingService.js';

/**
 * Worker GPS-based Check-in
 * Validates worker eligibility, job coordinates, and 200-metre Haversine geofence.
 */
export const checkInWorkerGPS = async (req, res, next) => {
  try {
    const { jobId, latitude, longitude, accuracy } = req.body || {};
    const workerId = req.user._id;

    // 1. Validate coordinates presence and bounds
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS coordinates (latitude between -90 and 90, longitude between -180 and 180) are required.'
      });
    }

    // 2. Validate GPS accuracy if provided
    const reportedAccuracy = Number(accuracy);
    if (!isNaN(reportedAccuracy) && reportedAccuracy > 300) {
      return res.status(400).json({
        success: false,
        code: 'POOR_GPS_ACCURACY',
        message: `We couldn't verify your exact location due to poor GPS accuracy (~${Math.round(
          reportedAccuracy
        )}m). Please try again in an area with a stronger GPS signal.`
      });
    }

    // 3. Find Job and check coordinates
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.'
      });
    }

    const jobCoords = job.location?.coordinates;
    if (
      !jobCoords ||
      !Array.isArray(jobCoords) ||
      jobCoords.length < 2 ||
      (jobCoords[0] === 0 && jobCoords[1] === 0)
    ) {
      return res.status(400).json({
        success: false,
        code: 'JOB_COORDINATES_MISSING',
        message: 'This job does not have verified GPS coordinates configured. Please contact the employer for manual attendance confirmation.'
      });
    }

    const [jobLng, jobLat] = jobCoords;

    // 4. Verify worker is selected/confirmed for this job
    const assignment = await Assignment.findOne({
      job: jobId,
      worker: workerId,
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        code: 'WORKER_NOT_SELECTED',
        message: 'You are not selected for this job. Only hired workers can mark attendance.'
      });
    }

    // 5. Prevent duplicate check-in
    let attendance = await Attendance.findOne({ job: jobId, worker: workerId });
    if (
      attendance &&
      (attendance.status === ATTENDANCE_STATUSES.PRESENT_GPS ||
        attendance.status === ATTENDANCE_STATUSES.PRESENT_MANUAL)
    ) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_CHECKED_IN',
        message: 'Attendance has already been marked for this shift.'
      });
    }

    // 6. Calculate Haversine distance in meters
    const distanceKm = calculateDistanceKmPrecise(lat, lng, jobLat, jobLng);
    if (distanceKm === null) {
      return res.status(400).json({
        success: false,
        message: 'Unable to calculate distance between your location and the venue.'
      });
    }

    const distanceMeters = Math.round(distanceKm * 1000);
    const permittedRadius = job.attendanceRadiusMeters || ATTENDANCE_RADIUS_METERS || 200;

    // 7. Geofence enforcement: must be <= 200 metres
    if (distanceMeters > permittedRadius) {
      const distanceDisplay =
        distanceMeters > 1000
          ? `${(distanceMeters / 1000).toFixed(1)} km`
          : `${distanceMeters} metres`;

      return res.status(400).json({
        success: false,
        code: 'OUTSIDE_ATTENDANCE_RADIUS',
        message: `You are outside the permitted ${permittedRadius}-metre attendance area. Please reach the job location and try again.`,
        distanceMeters,
        permittedRadius,
        distanceDisplay
      });
    }

    // 8. Record verified GPS attendance
    const now = new Date();
    const prevStatus = attendance ? attendance.status : ATTENDANCE_STATUSES.PENDING;

    if (!attendance) {
      attendance = new Attendance({
        job: jobId,
        worker: workerId,
        employer: job.employer,
        assignment: assignment._id
      });
    }

    attendance.status = ATTENDANCE_STATUSES.PRESENT_GPS;
    attendance.method = ATTENDANCE_METHODS.GPS;
    attendance.checkInCoordinates = { latitude: lat, longitude: lng };
    attendance.accuracyMeters = !isNaN(reportedAccuracy) ? reportedAccuracy : null;
    attendance.distanceMeters = distanceMeters;
    attendance.checkedInAt = now;
    attendance.markedBy = workerId;
    attendance.reason = `Worker GPS verified at ~${distanceMeters}m from venue`;

    attendance.auditHistory.push({
      action: 'CHECK_IN',
      previousStatus: prevStatus,
      newStatus: ATTENDANCE_STATUSES.PRESENT_GPS,
      changedBy: workerId,
      reason: `GPS check-in verified within ${permittedRadius}m radius (${distanceMeters}m)`,
      changedAt: now,
      metadata: {
        distanceMeters,
        accuracyMeters: attendance.accuracyMeters,
        coordinates: { latitude: lat, longitude: lng }
      }
    });

    await attendance.save();

    // Mirror in assignment record for backward compatibility
    await Assignment.findByIdAndUpdate(assignment._id, {
      'attendance.checkedInAt': now,
      'attendance.notes': `GPS Verified (${distanceMeters}m from venue)`
    });

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully. Your GPS location has been verified.',
      attendance: {
        id: attendance._id,
        status: attendance.status,
        method: attendance.method,
        distanceMeters,
        checkedInAt: attendance.checkedInAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Worker's attendance history for all their confirmed shifts
 */
export const getMyAttendanceHistory = async (req, res, next) => {
  try {
    const workerId = req.user._id;

    // Get all non-cancelled assignments for this worker
    const assignments = await Assignment.find({
      worker: workerId,
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    })
      .populate('job', 'title locationName location workDate startTime endTime grossPay payBasis')
      .populate('employer', 'name email')
      .sort({ 'agreedSchedule.workDate': -1 })
      .lean();

    const assignmentJobIds = assignments.map((a) => a.job?._id).filter(Boolean);

    // Fetch existing attendance records
    const attendanceRecords = await Attendance.find({
      worker: workerId,
      job: { $in: assignmentJobIds }
    }).lean();

    const attendanceMap = new Map();
    attendanceRecords.forEach((att) => {
      attendanceMap.set(att.job.toString(), att);
    });

    // Merge so every confirmed assignment has an attendance status
    const history = assignments.map((a) => {
      const att = attendanceMap.get(a.job?._id?.toString());
      return {
        assignmentId: a._id,
        job: a.job || {
          _id: a._id,
          title: 'Shift Assignment',
          locationName: 'Work Location',
          location: { coordinates: [0, 0] },
          workDate: a.agreedSchedule?.workDate || new Date().toISOString(),
          startTime: a.agreedSchedule?.startTime || '09:00',
          endTime: a.agreedSchedule?.endTime || '17:00'
        },
        employer: a.employer || { name: 'Local Employer', email: '' },
        agreedSchedule: a.agreedSchedule,
        status: att ? att.status : ATTENDANCE_STATUSES.PENDING,
        method: att ? att.method : null,
        checkedInAt: att ? att.checkedInAt : null,
        distanceMeters: att ? att.distanceMeters : null,
        accuracyMeters: att ? att.accuracyMeters : null,
        reason: att ? att.reason : '',
        attendanceId: att ? att._id : null
      };
    });

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Worker's attendance status for a single job
 */
export const getWorkerJobAttendanceStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const workerId = req.user._id;

    const assignment = await Assignment.findOne({
      job: jobId,
      worker: workerId,
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    })
      .populate('job', 'title locationName location workDate startTime endTime attendanceRadiusMeters coordinatesConfirmed')
      .lean();

    if (!assignment) {
      return res.status(200).json({
        success: true,
        isSelected: false,
        attendance: null,
        message: 'Worker is not selected for this job.'
      });
    }

    const attendance = await Attendance.findOne({ job: jobId, worker: workerId }).lean();

    res.status(200).json({
      success: true,
      isSelected: true,
      assignment: {
        id: assignment._id,
        agreedSchedule: assignment.agreedSchedule,
        job: assignment.job
      },
      attendance: attendance || {
        status: ATTENDANCE_STATUSES.PENDING,
        method: null,
        checkedInAt: null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employer's Attendance Overview: Job-wise attendance summary
 */
export const getEmployerAttendanceOverview = async (req, res, next) => {
  try {
    const employerId = req.user._id;

    const jobs = await Job.find({ employer: employerId })
      .sort({ workDate: -1 })
      .select('title locationName location workDate workEndDate startTime endTime status openings filledCount attendanceRadiusMeters coordinatesConfirmed')
      .lean();

    const jobIds = jobs.map((j) => j._id);

    // Get all confirmed assignments for these jobs
    const assignments = await Assignment.find({
      job: { $in: jobIds },
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    }).lean();

    // Get all attendance records for these jobs
    const attendances = await Attendance.find({ job: { $in: jobIds } }).lean();

    const jobAssignmentsMap = new Map();
    assignments.forEach((a) => {
      const key = a.job.toString();
      if (!jobAssignmentsMap.has(key)) jobAssignmentsMap.set(key, []);
      jobAssignmentsMap.get(key).push(a);
    });

    const jobAttendanceMap = new Map();
    attendances.forEach((att) => {
      const key = att.job.toString();
      if (!jobAttendanceMap.has(key)) jobAttendanceMap.set(key, []);
      jobAttendanceMap.get(key).push(att);
    });

    const overview = jobs.map((job) => {
      const key = job._id.toString();
      const jobAssns = jobAssignmentsMap.get(key) || [];
      const jobAtts = jobAttendanceMap.get(key) || [];

      const totalSelected = jobAssns.length;
      let presentGps = 0;
      let presentManual = 0;
      let absent = 0;

      jobAtts.forEach((att) => {
        if (att.status === ATTENDANCE_STATUSES.PRESENT_GPS) presentGps++;
        else if (att.status === ATTENDANCE_STATUSES.PRESENT_MANUAL) presentManual++;
        else if (att.status === ATTENDANCE_STATUSES.ABSENT_MANUAL) absent++;
      });

      const presentTotal = presentGps + presentManual;
      const pending = Math.max(0, totalSelected - (presentTotal + absent));

      return {
        ...job,
        metrics: {
          totalSelected,
          presentTotal,
          presentGps,
          presentManual,
          absent,
          pending
        }
      };
    });

    res.status(200).json({
      success: true,
      jobs: overview
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employer's Job Attendance Detail: Lists only selected workers for that job
 */
export const getJobAttendanceDetail = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Authorization: only the employer who owns the job (or admin) can view attendance
    if (job.employer.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You do not have permission to view attendance for this job.'
      });
    }

    // Retrieve selected workers (Assignments only - excludes unselected applicants)
    const assignments = await Assignment.find({
      job: jobId,
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    })
      .populate('worker', 'name firstName lastName email verificationStatus')
      .lean();

    const attendanceRecords = await Attendance.find({ job: jobId })
      .populate('markedBy', 'name role')
      .lean();

    const attendanceMap = new Map();
    attendanceRecords.forEach((att) => {
      attendanceMap.set(att.worker.toString(), att);
    });

    let presentGpsCount = 0;
    let presentManualCount = 0;
    let absentCount = 0;

    const selectedWorkers = assignments.map((a) => {
      const workerId = a.worker?._id?.toString();
      const att = workerId ? attendanceMap.get(workerId) : null;

      const currentStatus = att ? att.status : ATTENDANCE_STATUSES.PENDING;

      if (currentStatus === ATTENDANCE_STATUSES.PRESENT_GPS) presentGpsCount++;
      else if (currentStatus === ATTENDANCE_STATUSES.PRESENT_MANUAL) presentManualCount++;
      else if (currentStatus === ATTENDANCE_STATUSES.ABSENT_MANUAL) absentCount++;

      return {
        assignmentId: a._id,
        worker: a.worker,
        status: currentStatus,
        method: att ? att.method : null,
        checkedInAt: att ? att.checkedInAt : null,
        distanceMeters: att ? att.distanceMeters : null,
        accuracyMeters: att ? att.accuracyMeters : null,
        reason: att ? att.reason : '',
        markedBy: att ? att.markedBy : null,
        attendanceId: att ? att._id : null,
        auditHistoryCount: att?.auditHistory?.length || 0
      };
    });

    const totalSelected = selectedWorkers.length;
    const presentCount = presentGpsCount + presentManualCount;
    const pendingCount = Math.max(0, totalSelected - (presentCount + absentCount));

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        title: job.title,
        locationName: job.locationName,
        location: job.location,
        workDate: job.workDate,
        workEndDate: job.workEndDate,
        startTime: job.startTime,
        endTime: job.endTime,
        attendanceRadiusMeters: job.attendanceRadiusMeters || ATTENDANCE_RADIUS_METERS,
        coordinatesConfirmed: job.coordinatesConfirmed
      },
      summary: {
        totalSelected,
        presentCount,
        presentGpsCount,
        presentManualCount,
        absentCount,
        pendingCount
      },
      workers: selectedWorkers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employer Manual Attendance Marking
 * Marks a selected worker as Present or Absent with required reason and audit log
 */
export const markWorkerManualAttendance = async (req, res, next) => {
  try {
    const { jobId, workerId } = req.params;
    const { status, reason, allowCorrection = false } = req.body || {};
    const employerId = req.user._id;

    // 1. Validate status
    if (
      status !== ATTENDANCE_STATUSES.PRESENT_MANUAL &&
      status !== ATTENDANCE_STATUSES.ABSENT_MANUAL
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid attendance status '${status}'. Must be '${ATTENDANCE_STATUSES.PRESENT_MANUAL}' or '${ATTENDANCE_STATUSES.ABSENT_MANUAL}'.`
      });
    }

    // 2. Validate reason (mandatory)
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A clear reason (at least 3 characters) is required when manually recording or changing attendance.'
      });
    }

    // 3. Verify Job ownership
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.employer.toString() !== employerId.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only the job owner can manage attendance.'
      });
    }

    // 4. Verify worker has an active assignment for this job
    const assignment = await Assignment.findOne({
      job: jobId,
      worker: workerId,
      status: { $ne: ASSIGNMENT_STATUSES.CANCELLED }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Selected worker assignment not found for this job.'
      });
    }

    // 5. Check existing attendance record
    let attendance = await Attendance.findOne({ job: jobId, worker: workerId });
    const now = new Date();
    const prevStatus = attendance ? attendance.status : ATTENDANCE_STATUSES.PENDING;

    // 6. Protection: Never silently overwrite GPS attendance
    if (
      attendance &&
      attendance.status === ATTENDANCE_STATUSES.PRESENT_GPS &&
      !allowCorrection
    ) {
      return res.status(409).json({
        success: false,
        code: 'REQUIRES_EXPLICIT_CORRECTION',
        message: 'This worker already has verified GPS attendance. To modify a GPS-verified record, please use the explicit correction confirmation.'
      });
    }

    if (!attendance) {
      attendance = new Attendance({
        job: jobId,
        worker: workerId,
        employer: job.employer,
        assignment: assignment._id
      });
    }

    const actionType = allowCorrection
      ? 'CORRECTION'
      : status === ATTENDANCE_STATUSES.PRESENT_MANUAL
      ? 'MANUAL_PRESENT'
      : 'MANUAL_ABSENT';

    attendance.status = status;
    attendance.method = ATTENDANCE_METHODS.MANUAL;
    attendance.markedBy = employerId;
    attendance.reason = reason.trim();
    if (status === ATTENDANCE_STATUSES.PRESENT_MANUAL && !attendance.checkedInAt) {
      attendance.checkedInAt = now;
    }

    attendance.auditHistory.push({
      action: actionType,
      previousStatus: prevStatus,
      newStatus: status,
      changedBy: employerId,
      reason: reason.trim(),
      changedAt: now,
      metadata: {
        wasGpsVerified: prevStatus === ATTENDANCE_STATUSES.PRESENT_GPS
      }
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: `Worker successfully marked as ${
        status === ATTENDANCE_STATUSES.PRESENT_MANUAL ? 'Present' : 'Absent'
      }.`,
      attendance: {
        id: attendance._id,
        status: attendance.status,
        method: attendance.method,
        checkedInAt: attendance.checkedInAt,
        reason: attendance.reason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employer Attendance Record Correction
 * Explicitly updates an existing record with mandatory reason and audit entry
 */
export const correctAttendanceRecord = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { status, reason } = req.body || {};
    const employerId = req.user._id;

    if (
      status !== ATTENDANCE_STATUSES.PRESENT_MANUAL &&
      status !== ATTENDANCE_STATUSES.ABSENT_MANUAL &&
      status !== ATTENDANCE_STATUSES.PENDING
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid target status '${status}'.`
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A documented explanation (minimum 3 characters) is required for attendance correction.'
      });
    }

    const attendance = await Attendance.findById(attendanceId).populate('job');
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    if (
      attendance.employer.toString() !== employerId.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You do not have permission to correct this record.'
      });
    }

    const prevStatus = attendance.status;
    const now = new Date();

    attendance.status = status;
    attendance.method = status === ATTENDANCE_STATUSES.PENDING ? null : ATTENDANCE_METHODS.MANUAL;
    attendance.markedBy = employerId;
    attendance.reason = reason.trim();
    if (status === ATTENDANCE_STATUSES.PRESENT_MANUAL && !attendance.checkedInAt) {
      attendance.checkedInAt = now;
    }

    attendance.auditHistory.push({
      action: 'CORRECTION',
      previousStatus: prevStatus,
      newStatus: status,
      changedBy: employerId,
      reason: reason.trim(),
      changedAt: now,
      metadata: {
        originalGpsCoords: attendance.checkInCoordinates,
        originalDistance: attendance.distanceMeters
      }
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance record corrected successfully.',
      attendance: {
        id: attendance._id,
        status: attendance.status,
        method: attendance.method,
        checkedInAt: attendance.checkedInAt,
        reason: attendance.reason,
        auditHistoryCount: attendance.auditHistory.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch Audit History for an attendance record
 */
export const getAttendanceAuditHistory = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findById(attendanceId)
      .populate('auditHistory.changedBy', 'name role email')
      .populate('worker', 'name email')
      .populate('job', 'title employer')
      .lean();

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    // Caller must be the worker, the employer, or an admin
    const userId = req.user._id.toString();
    const isWorker = attendance.worker?._id?.toString() === userId;
    const isEmployer = attendance.employer?.toString() === userId || attendance.job?.employer?.toString() === userId;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isWorker && !isEmployer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    res.status(200).json({
      success: true,
      attendanceId: attendance._id,
      worker: attendance.worker,
      currentStatus: attendance.status,
      auditHistory: attendance.auditHistory || []
    });
  } catch (error) {
    next(error);
  }
};
