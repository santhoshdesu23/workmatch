/**
 * WorkMatch Frontend Job Schedule Validation Utilities
 *
 * Rules:
 * 1. Work start date and time must be in the future:
 *    - Rejects past dates.
 *    - Rejects past times when today's date is selected.
 *    - Rejects a start time equal to the current time.
 *    - Accepts valid future dates and times.
 * 2. Work end date and time must be after the work start date and time:
 *    - Rejects an end time earlier than the start time.
 *    - Rejects an end time equal to the start time.
 *    - Allows work that continues into the next day when the end date is later than the start date.
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_MIDNIGHT_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.000)?)?Z$/;

export interface CalendarDateParts {
  year: number;
  monthIndex: number;
  day: number;
}

export interface ScheduleFieldErrors {
  workDate?: string;
  workEndDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  error: string | null;
  errors: ScheduleFieldErrors;
  startDateTime: Date | null;
  endDateTime: Date | null;
  durationHours: number | null;
  isOvernight: boolean;
}

export interface ScheduleValidationInput {
  workDate?: Date | string | number | null;
  workEndDate?: Date | string | number | null;
  endDate?: Date | string | number | null;
  startTime?: string | null;
  endTime?: string | null;
  now?: Date | string | number;
}

export function isValidTimeString(timeStr: unknown): timeStr is string {
  if (typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr.trim());
}

function isValidCalendarParts(year: number, monthIndex: number, day: number): boolean {
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

export function extractCalendarDateParts(
  dateInput: Date | string | number | null | undefined
): CalendarDateParts | null {
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

export function formatCalendarDate(dateInput: Date | string | number | null | undefined): string {
  const parts = extractCalendarDateParts(dateInput);
  if (!parts) return '';
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.monthIndex + 1).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateString(now: Date = new Date()): string {
  return formatCalendarDate(now);
}

export function validateJobSchedule({
  workDate,
  workEndDate,
  endDate,
  startTime,
  endTime,
  now = new Date()
}: ScheduleValidationInput = {}): ScheduleValidationResult {
  const errors: ScheduleFieldErrors = {};

  const hasWorkDate =
    workDate !== undefined &&
    workDate !== null &&
    !(typeof workDate === 'string' && workDate.trim() === '');

  const hasExplicitEndDate =
    (workEndDate !== undefined &&
      workEndDate !== null &&
      !(typeof workEndDate === 'string' && workEndDate.trim() === '')) ||
    (endDate !== undefined &&
      endDate !== null &&
      !(typeof endDate === 'string' && endDate.trim() === ''));

  const rawEndDate =
    workEndDate !== undefined &&
    workEndDate !== null &&
    !(typeof workEndDate === 'string' && workEndDate.trim() === '')
      ? workEndDate
      : endDate !== undefined &&
        endDate !== null &&
        !(typeof endDate === 'string' && endDate.trim() === '')
      ? endDate
      : workDate;

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

  let selectedStartDay: Date | null = null;
  let selectedEndDay: Date | null = null;

  if (startDateParts) {
    selectedStartDay = new Date(
      startDateParts.year,
      startDateParts.monthIndex,
      startDateParts.day,
      0,
      0,
      0,
      0
    );
    if (selectedStartDay.getTime() < todayDay.getTime()) {
      errors.workDate = 'Work start date cannot be in the past.';
    }
  }

  if (startDateParts && endDateParts) {
    selectedEndDay = new Date(
      endDateParts.year,
      endDateParts.monthIndex,
      endDateParts.day,
      0,
      0,
      0,
      0
    );
    if (selectedStartDay && selectedEndDay.getTime() < selectedStartDay.getTime()) {
      errors.workEndDate = 'Work end date cannot be earlier than the work start date.';
    }
  }

  let startDateTime: Date | null = null;
  let endDateTime: Date | null = null;
  let durationHours: number | null = null;
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
        errors.startTime =
          'Work start time must be in the future and cannot equal the current time.';
      } else if (
        startDateTime.getTime() < nowMinute.getTime() ||
        startDateTime.getTime() <= refNow.getTime()
      ) {
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
        errors.endTime =
          'Work end time cannot be equal to the start time. Work end date and time must be after the work start date and time.';
      } else if (endDateTime.getTime() < startDateTime.getTime()) {
        errors.endTime = 'Work end date and time must be after the work start date and time.';
      } else {
        const durationMs = endDateTime.getTime() - startDateTime.getTime();
        durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
        isOvernight = Boolean(
          selectedEndDay &&
            selectedStartDay &&
            selectedEndDay.getTime() > selectedStartDay.getTime()
        );
      }
    } else if (!hasExplicitEndDate) {
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes === startMinutes) {
        errors.endTime =
          'Work end time cannot be equal to the start time. Work end date and time must be after the work start date and time.';
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
 * Combines a calendar date input and a 24-hour "HH:mm" time string into a local Date instance.
 */
export function combineDateAndTime(
  dateInput: Date | string | number | null | undefined,
  timeStr: string | null | undefined
): Date | null {
  const parts = extractCalendarDateParts(dateInput);
  if (!parts || !isValidTimeString(timeStr)) return null;
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return new Date(parts.year, parts.monthIndex, parts.day, hours, minutes, 0, 0);
}

export interface ShiftScheduleLike {
  workDate?: Date | string | number | null;
  workEndDate?: Date | string | number | null;
  startTime?: string | null;
  endTime?: string | null;
  applicationDeadline?: Date | string | number | null;
  status?: string | null;
  openings?: number;
  filledCount?: number;
  agreedSchedule?: {
    workDate?: Date | string | number | null;
    workEndDate?: Date | string | number | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
}

/**
 * Computes the local Date representation of a job's scheduled start time.
 */
export function getJobShiftStartDateTime(job: ShiftScheduleLike | null | undefined): Date | null {
  if (!job) return null;
  const workDate = job.workDate || job.agreedSchedule?.workDate;
  const startTime = job.startTime || job.agreedSchedule?.startTime;
  if (!workDate || !isValidTimeString(startTime)) return null;

  return combineDateAndTime(workDate, startTime);
}

/**
 * Computes the local Date representation of a job's scheduled end time.
 */
export function getJobShiftEndDateTime(job: ShiftScheduleLike | null | undefined): Date | null {
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
    return new Date(startParts.year, startParts.monthIndex, startParts.day + 1, endH, endM, 0, 0);
  }

  return new Date(endParts.year, endParts.monthIndex, endParts.day, endH, endM, 0, 0);
}

/**
 * Resolves the effective application deadline timestamp for a job.
 */
export function getJobApplicationDeadline(job: ShiftScheduleLike | null | undefined): Date | null {
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
 */
export function isJobApplicationDeadlinePassed(
  job: ShiftScheduleLike | null | undefined,
  now: Date | string | number = new Date()
): boolean {
  const deadline = getJobApplicationDeadline(job);
  if (!deadline) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return deadline.getTime() <= refNow.getTime();
}

/**
 * Returns true if the scheduled work end date and time has passed.
 */
export function isJobWorkEnded(
  job: ShiftScheduleLike | null | undefined,
  now: Date | string | number = new Date()
): boolean {
  const endDateTime = getJobShiftEndDateTime(job);
  if (!endDateTime) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return endDateTime.getTime() <= refNow.getTime();
}

/**
 * Returns true if the shift is currently active and ongoing.
 */
export function isJobWorkOngoing(
  job: ShiftScheduleLike | null | undefined,
  now: Date | string | number = new Date()
): boolean {
  const startDateTime = getJobShiftStartDateTime(job);
  const endDateTime = getJobShiftEndDateTime(job);
  if (!startDateTime || !endDateTime) return false;
  const refNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date(now);
  return startDateTime.getTime() <= refNow.getTime() && refNow.getTime() < endDateTime.getTime();
}

/**
 * Determines whether a job is currently open and accepting worker applications.
 */
export function isJobOpenForApplications(
  job: ShiftScheduleLike | null | undefined,
  now: Date | string | number = new Date()
): boolean {
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
 */
export function getEffectiveJobStatus(
  job: ShiftScheduleLike | null | undefined,
  now: Date | string | number = new Date()
): 'CANCELLED' | 'COMPLETED' | 'WORK_ENDED' | 'IN_PROGRESS' | 'FILLED' | 'APPLICATIONS_CLOSED' | 'OPEN' | string {
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

