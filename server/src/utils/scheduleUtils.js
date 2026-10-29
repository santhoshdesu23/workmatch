/**
 * WorkMatch Schedule & Shift Interval Utilities
 * Provides exact shift-overlap math, timezone normalization, back-to-back shift policy,
 * and future start / end date-time schedule validation.
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_MIDNIGHT_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.000)?)?Z$/;

/**
 * Validates a 24-hour time string in "HH:mm" format.
 * @param {string} timeStr - e.g. "09:00", "17:30"
 * @returns {boolean}
 */
export function isValidTimeString(timeStr) {
  if (typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr.trim());
}

/**
 * Verifies that calendar components (year, monthIndex 0-11, day 1-31) represent a real calendar date.
 * @param {number} year
 * @param {number} monthIndex
 * @param {number} day
 * @returns {boolean}
 */
function isValidCalendarParts(year, monthIndex, day) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return false;
  }
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(year, monthIndex, day);
  return (
    !isNaN(probe.getTime()) &&
    probe.getFullYear() === year &&
    probe.getMonth() === monthIndex &&
    probe.getDate() === day
  );
}

/**
 * Extracts normalized calendar date components { year, monthIndex, day } consistently across
 * "YYYY-MM-DD" strings, UTC-midnight ISO strings / Date objects, and local Date timestamps.
 *
 * @param {Date|string|number} dateInput
 * @returns {{ year: number, monthIndex: number, day: number } | null}
 */
export function extractCalendarDateParts(dateInput) {
  if (dateInput === undefined || dateInput === null) return null;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = DATE_ONLY_REGEX.exec(trimmed);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const monthIndex = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      return isValidCalendarParts(year, monthIndex, day) ? { year, monthIndex, day } : null;
    }

    const utcMidnightMatch = UTC_MIDNIGHT_ISO_REGEX.exec(trimmed);
    if (utcMidnightMatch) {
      const year = Number(utcMidnightMatch[1]);
      const monthIndex = Number(utcMidnightMatch[2]) - 1;
      const day = Number(utcMidnightMatch[3]);
      return isValidCalendarParts(year, monthIndex, day) ? { year, monthIndex, day } : null;
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    return {
      year: parsed.getFullYear(),
      monthIndex: parsed.getMonth(),
      day: parsed.getDate()
    };
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    if (
      dateInput.getUTCHours() === 0 &&
      dateInput.getUTCMinutes() === 0 &&
      dateInput.getUTCSeconds() === 0 &&
      dateInput.getUTCMilliseconds() === 0
    ) {
      return {
        year: dateInput.getUTCFullYear(),
        monthIndex: dateInput.getUTCMonth(),
        day: dateInput.getUTCDate()
      };
    }
    return {
      year: dateInput.getFullYear(),
      monthIndex: dateInput.getMonth(),
      day: dateInput.getDate()
    };
  }

  if (typeof dateInput === 'number') {
    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) return null;
    return {
      year: parsed.getFullYear(),
      monthIndex: parsed.getMonth(),
      day: parsed.getDate()
    };
  }

  return null;
}

/**
 * Formats a date input into a "YYYY-MM-DD" calendar string.
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function formatCalendarDate(dateInput) {
  const parts = extractCalendarDateParts(dateInput);
  if (!parts) return '';
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.monthIndex + 1).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Combines a calendar date input and a 24-hour "HH:mm" time string into a local Date instance.
 * @param {Date|string|number} dateInput
 * @param {string} timeStr
 * @returns {Date|null}
 */
export function combineDateAndTime(dateInput, timeStr) {
  const parts = extractCalendarDateParts(dateInput);
  if (!parts || !isValidTimeString(timeStr)) return null;
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return new Date(parts.year, parts.monthIndex, parts.day, hours, minutes, 0, 0);
}

/**
 * Validates a job schedule according to WorkMatch scheduling rules:
 * 1. Work start date and time must be strictly in the future:
 *    - Rejects past dates.
 *    - Rejects past times when today's date is selected.
 *    - Rejects a start time equal to the current time.
 *    - Accepts valid future dates and times.
 * 2. Work end date and time must be strictly after work start date and time:
 *    - Rejects an end time earlier than the start time on the same date.
 *    - Rejects an end time equal to the start time.
 *    - Allows work that continues into the next day when the end date is later than the start date.
 *
 * @param {{
 *   workDate?: Date|string|number,
 *   workEndDate?: Date|string|number,
 *   endDate?: Date|string|number,
 *   startTime?: string,
 *   endTime?: string,
 *   now?: Date|string|number
 * }} params
 * @returns {{
 *   isValid: boolean,
 *   error: string | null,
 *   errors: { workDate?: string, workEndDate?: string, startTime?: string, endTime?: string },
 *   startDateTime: Date | null,
 *   endDateTime: Date | null,
 *   durationHours: number | null,
 *   isOvernight: boolean
 * }}
 */
export function validateJobSchedule({
  workDate,
  workEndDate,
  endDate,
  startTime,
  endTime,
  now = new Date()
} = {}) {
  const errors = {};

  const hasWorkDate =
    workDate !== undefined &&
    workDate !== null &&
    !(typeof workDate === 'string' && workDate.trim() === '');

  const rawEndDate =
    workEndDate !== undefined && workEndDate !== null && !(typeof workEndDate === 'string' && workEndDate.trim() === '')
      ? workEndDate
      : endDate !== undefined && endDate !== null && !(typeof endDate === 'string' && endDate.trim() === '')
      ? endDate
      : workDate;

  const hasExplicitEndDate =
    (workEndDate !== undefined && workEndDate !== null && !(typeof workEndDate === 'string' && workEndDate.trim() === '')) ||
    (endDate !== undefined && endDate !== null && !(typeof endDate === 'string' && endDate.trim() === ''));

  const startDateParts = hasWorkDate ? extractCalendarDateParts(workDate) : null;
  if (!hasWorkDate) {
    errors.workDate = 'Work start date is required.';
  } else if (!startDateParts) {
    errors.workDate = 'Invalid work date format.';
  }

  const endDateParts = hasExplicitEndDate ? extractCalendarDateParts(rawEndDate) : startDateParts;
  if (hasExplicitEndDate && !endDateParts) {
    errors.workEndDate = 'Invalid work end date format.';
  }

  const hasStartTime = typeof startTime === 'string' && startTime.trim() !== '';
  const hasEndTime = typeof endTime === 'string' && endTime.trim() !== '';
  const validStartTime = hasStartTime && isValidTimeString(startTime);
  const validEndTime = hasEndTime && isValidTimeString(endTime);

  if (!hasStartTime && !hasEndTime) {
    errors.startTime = 'Shift start and end times are required.';
    errors.endTime = 'Shift start and end times are required.';
  } else {
    if (!hasStartTime) {
      errors.startTime = 'Shift start and end times are required. Work start time is required.';
    } else if (!validStartTime) {
      errors.startTime = 'Invalid start time format. Expected HH:mm (00:00 - 23:59).';
    }

    if (!hasEndTime) {
      errors.endTime = 'Shift start and end times are required. Work end time is required.';
    } else if (!validEndTime) {
      errors.endTime = 'Invalid end time format. Expected HH:mm (00:00 - 23:59).';
    }
  }

  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  const todayDay = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate(), 0, 0, 0, 0);
  const nowMinute = new Date(
    refNow.getFullYear(),
    refNow.getMonth(),
    refNow.getDate(),
    refNow.getHours(),
    refNow.getMinutes(),
    0,
    0
  );

  let selectedStartDay = null;
  let selectedEndDay = null;

  if (startDateParts) {
    selectedStartDay = new Date(startDateParts.year, startDateParts.monthIndex, startDateParts.day, 0, 0, 0, 0);
    if (selectedStartDay.getTime() < todayDay.getTime()) {
      errors.workDate = 'Work start date cannot be in the past.';
    }
  }

  if (startDateParts && endDateParts) {
    selectedEndDay = new Date(endDateParts.year, endDateParts.monthIndex, endDateParts.day, 0, 0, 0, 0);
    if (selectedEndDay.getTime() < selectedStartDay.getTime()) {
      errors.workEndDate = 'Work end date cannot be earlier than the work start date.';
    }
  }

  let startDateTime = null;
  let endDateTime = null;
  let durationHours = null;
  let isOvernight = false;

  if (validStartTime && startDateParts) {
    const [startH, startM] = startTime.trim().split(':').map(Number);
    startDateTime = new Date(
      startDateParts.year,
      startDateParts.monthIndex,
      startDateParts.day,
      startH,
      startM,
      0,
      0
    );

    if (selectedStartDay && selectedStartDay.getTime() === todayDay.getTime()) {
      if (startDateTime.getTime() === nowMinute.getTime()) {
        errors.startTime = 'Work start time must be in the future and cannot equal the current time.';
      } else if (startDateTime.getTime() < nowMinute.getTime() || startDateTime.getTime() <= refNow.getTime()) {
        errors.startTime = "Work start time cannot be in the past when today's date is selected.";
      }
    } else if (startDateTime.getTime() <= refNow.getTime() && !errors.workDate) {
      errors.startTime = 'Work start date and time must be in the future.';
    }
  }

  if (validStartTime && validEndTime) {
    const [startH, startM] = startTime.trim().split(':').map(Number);
    const [endH, endM] = endTime.trim().split(':').map(Number);

    if (startDateParts && endDateParts && startDateTime) {
      endDateTime = new Date(
        endDateParts.year,
        endDateParts.monthIndex,
        endDateParts.day,
        endH,
        endM,
        0,
        0
      );

      if (endDateTime.getTime() === startDateTime.getTime()) {
        errors.endTime = 'Work end time cannot be equal to the start time. Work end date and time must be after the work start date and time.';
      } else if (endDateTime.getTime() < startDateTime.getTime()) {
        errors.endTime = 'Work end date and time must be after the work start date and time.';
      } else {
        const durationMs = endDateTime.getTime() - startDateTime.getTime();
        durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
        isOvernight = Boolean(selectedEndDay && selectedStartDay && selectedEndDay.getTime() > selectedStartDay.getTime());
      }
    } else if (!hasExplicitEndDate) {
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes === startMinutes) {
        errors.endTime = 'Work end time cannot be equal to the start time. Work end date and time must be after the work start date and time.';
      } else if (endMinutes < startMinutes) {
        errors.endTime = 'Work end date and time must be after the work start date and time.';
      }
    }
  }

  const error =
    errors.workDate ||
    errors.startTime ||
    errors.workEndDate ||
    errors.endTime ||
    null;

  return {
    isValid: error === null,
    error,
    errors,
    startDateTime,
    endDateTime,
    durationHours,
    isOvernight
  };
}

/**
 * Computes absolute shift start and end timestamps.
 * 
 * Shift Policy & Timezone Conventions:
 * - A job's `workDate` represents the calendar date of the shift.
 * - `startTime` and `endTime` are 24-hour local clock times (HH:mm).
 * - Standard shifts: endTime > startTime (e.g. 09:00 to 17:00 on the same date).
 * - Overnight shifts: when `workEndDate` is on a subsequent date, or when `endTime <= startTime`
 *   (e.g. 22:00 to 06:00), the shift begins on `workDate` and ends on the morning of `workEndDate` / `workDate + 1 day`.
 * - Absolute milliseconds are computed using normalized UTC components (year, month, day, hours, minutes)
 *   to ensure deterministic, timezone-agnostic comparison.
 * 
 * @param {Date|string} workDate - The calendar date of the shift
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @param {Date|string} [workEndDate] - Optional end calendar date of the shift
 * @returns {{ start: Date, end: Date, durationHours: number, isOvernight: boolean }}
 */
export function getShiftInterval(workDate, startTime, endTime, workEndDate) {
  if (!workDate) throw new Error('workDate is required');
  if (!isValidTimeString(startTime)) throw new Error(`Invalid startTime format: "${startTime}". Expected "HH:mm" (00:00 - 23:59).`);
  if (!isValidTimeString(endTime)) throw new Error(`Invalid endTime format: "${endTime}". Expected "HH:mm" (00:00 - 23:59).`);

  const d = new Date(workDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid workDate: "${workDate}"`);
  }

  const [startH, startM] = startTime.trim().split(':').map(Number);
  const [endH, endM] = endTime.trim().split(':').map(Number);

  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;

  // Use UTC component constructors for deterministic interval math
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  const start = new Date(Date.UTC(y, m, day, startH, startM, 0, 0));

  let end;
  let isOvernight;

  if (workEndDate) {
    const endD = new Date(workEndDate);
    if (!isNaN(endD.getTime())) {
      const endY = endD.getUTCFullYear();
      const endM = endD.getUTCMonth();
      const endDay = endD.getUTCDate();
      const startDayUtc = Date.UTC(y, m, day);
      const endDayUtc = Date.UTC(endY, endM, endDay);

      if (endDayUtc > startDayUtc) {
        isOvernight = true;
        end = new Date(Date.UTC(endY, endM, endDay, endH, endM, 0, 0));
      }
    }
  }

  if (!end) {
    isOvernight = endTotalMinutes <= startTotalMinutes;
    end = new Date(Date.UTC(y, m, isOvernight ? day + 1 : day, endH, endM, 0, 0));
  }

  const durationMs = end.getTime() - start.getTime();
  const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

  return {
    start,
    end,
    durationHours,
    isOvernight
  };
}

/**
 * Determines whether two shift intervals overlap.
 * 
 * Formal Definition:
 * Interval A [A_start, A_end] overlaps Interval B [B_start, B_end] if and only if:
 * A_start < B_end AND A_end > B_start.
 * 
 * Boundary Policy:
 * Back-to-back shifts (where A_end === B_start or B_end === A_start) DO NOT overlap
 * and are permitted. Workers can finish one shift at 13:00 and start another at 13:00.
 * 
 * @param {{ start: Date, end: Date }} intervalA
 * @param {{ start: Date, end: Date }} intervalB
 * @returns {boolean}
 */
export function shiftsOverlap(intervalA, intervalB) {
  const aStart = intervalA.start.getTime();
  const aEnd = intervalA.end.getTime();
  const bStart = intervalB.start.getTime();
  const bEnd = intervalB.end.getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Computes the local Date representation of a job's scheduled start time.
 * Accepts a Job document, lean job object, or assignment containing `agreedSchedule`.
 *
 * @param {object} job
 * @returns {Date|null}
 */
export function getJobShiftStartDateTime(job) {
  if (!job) return null;
  const workDate = job.workDate || job.agreedSchedule?.workDate;
  const startTime = job.startTime || job.agreedSchedule?.startTime;
  if (!workDate || !isValidTimeString(startTime)) return null;

  return combineDateAndTime(workDate, startTime);
}

/**
 * Computes the local Date representation of a job's scheduled end time.
 * Correctly accounts for multi-day shifts and overnight shifts rolling past midnight.
 *
 * @param {object} job
 * @returns {Date|null}
 */
export function getJobShiftEndDateTime(job) {
  if (!job) return null;
  const workDate = job.workDate || job.agreedSchedule?.workDate;
  const workEndDate = job.workEndDate || job.agreedSchedule?.workEndDate || workDate;
  const startTime = job.startTime || job.agreedSchedule?.startTime;
  const endTime = job.endTime || job.agreedSchedule?.endTime;

  if (!workDate || !isValidTimeString(endTime)) return null;

  const startParts = extractCalendarDateParts(workDate);
  if (!startParts) return null;

  const endParts = extractCalendarDateParts(workEndDate) || startParts;
  const [endH, endM] = endTime.trim().split(':').map(Number);

  const [startH, startM] = isValidTimeString(startTime)
    ? startTime.trim().split(':').map(Number)
    : [0, 0];
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isSameCalendarDay =
    startParts.year === endParts.year &&
    startParts.monthIndex === endParts.monthIndex &&
    startParts.day === endParts.day;

  if (isSameCalendarDay && endMinutes <= startMinutes) {
    // Overnight shift crossing midnight on the same nominal calendar date
    return new Date(startParts.year, startParts.monthIndex, startParts.day + 1, endH, endM, 0, 0);
  }

  return new Date(endParts.year, endParts.monthIndex, endParts.day, endH, endM, 0, 0);
}

/**
 * Resolves the effective application deadline timestamp for a job.
 * Falls back to shift start date-time for legacy jobs or date-only deadlines.
 *
 * @param {object} job
 * @returns {Date|null}
 */
export function getJobApplicationDeadline(job) {
  if (!job) return null;
  const shiftStart = getJobShiftStartDateTime(job);

  if (job.applicationDeadline) {
    const rawDeadline =
      job.applicationDeadline instanceof Date
        ? job.applicationDeadline
        : new Date(job.applicationDeadline);

    if (!isNaN(rawDeadline.getTime())) {
      const deadlineParts = extractCalendarDateParts(job.applicationDeadline);
      const workDateParts = extractCalendarDateParts(job.workDate);

      const isMidnight =
        (rawDeadline.getUTCHours() === 0 &&
          rawDeadline.getUTCMinutes() === 0 &&
          rawDeadline.getUTCSeconds() === 0) ||
        (rawDeadline.getHours() === 0 &&
          rawDeadline.getMinutes() === 0 &&
          rawDeadline.getSeconds() === 0);

      // When deadline was saved as a date-only value matching the shift start day at midnight,
      // workers can apply up until the shift starts rather than prematurely expiring at 00:00.
      if (
        isMidnight &&
        shiftStart &&
        workDateParts &&
        deadlineParts &&
        deadlineParts.year === workDateParts.year &&
        deadlineParts.monthIndex === workDateParts.monthIndex &&
        deadlineParts.day === workDateParts.day
      ) {
        return shiftStart;
      }
      return rawDeadline;
    }
  }

  return shiftStart;
}

/**
 * Returns true if the application deadline has expired.
 *
 * @param {object} job
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isJobApplicationDeadlinePassed(job, now = new Date()) {
  const deadline = getJobApplicationDeadline(job);
  if (!deadline) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return deadline.getTime() <= refNow.getTime();
}

/**
 * Returns true if the scheduled work end date and time has passed.
 *
 * @param {object} job
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isJobWorkEnded(job, now = new Date()) {
  const endDateTime = getJobShiftEndDateTime(job);
  if (!endDateTime) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return endDateTime.getTime() <= refNow.getTime();
}

/**
 * Returns true if the shift is currently active and ongoing.
 *
 * @param {object} job
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isJobWorkOngoing(job, now = new Date()) {
  const startDateTime = getJobShiftStartDateTime(job);
  const endDateTime = getJobShiftEndDateTime(job);
  if (!startDateTime || !endDateTime) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return startDateTime.getTime() <= refNow.getTime() && refNow.getTime() < endDateTime.getTime();
}

/**
 * Determines whether a job is currently open and accepting worker applications.
 *
 * @param {object} job
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isJobOpenForApplications(job, now = new Date()) {
  if (!job) return false;
  if (job.status !== 'OPEN') return false;
  if (job.openings !== undefined && job.filledCount !== undefined && job.filledCount >= job.openings) {
    return false;
  }
  if (isJobApplicationDeadlinePassed(job, now)) return false;
  if (isJobWorkEnded(job, now)) return false;
  return true;
}

/**
 * Computes the human-facing effective status for display across dashboards and detail pages.
 *
 * @param {object} job
 * @param {Date|string|number} [now]
 * @returns {'CANCELLED'|'COMPLETED'|'WORK_ENDED'|'IN_PROGRESS'|'FILLED'|'APPLICATIONS_CLOSED'|'OPEN'|string}
 */
export function getEffectiveJobStatus(job, now = new Date()) {
  if (!job) return 'UNKNOWN';
  if (job.status === 'CANCELLED') return 'CANCELLED';
  if (job.status === 'COMPLETED') return 'COMPLETED';

  if (isJobWorkEnded(job, now)) {
    return 'WORK_ENDED';
  }

  if (isJobWorkOngoing(job, now)) {
    return 'IN_PROGRESS';
  }

  if (job.openings !== undefined && job.filledCount !== undefined && job.filledCount >= job.openings) {
    return 'FILLED';
  }

  if (isJobApplicationDeadlinePassed(job, now)) {
    return 'APPLICATIONS_CLOSED';
  }

  return job.status || 'OPEN';
}
