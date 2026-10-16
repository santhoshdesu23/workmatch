/**
 * WorkMatch Schedule & Shift Interval Utilities
 * Provides exact shift-overlap math, timezone normalization, and back-to-back shift policy.
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
 * Computes absolute shift start and end timestamps.
 * 
 * Shift Policy & Timezone Conventions:
 * - A job's `workDate` represents the calendar date of the shift.
 * - `startTime` and `endTime` are 24-hour local clock times (HH:mm).
 * - Standard shifts: endTime > startTime (e.g. 09:00 to 17:00 on the same date).
 * - Overnight shifts: endTime <= startTime (e.g. 22:00 to 06:00).
 *   The shift begins on `workDate` and ends on the morning of `workDate + 1 day`.
 * - Absolute milliseconds are computed using normalized UTC components (year, month, day, hours, minutes)
 *   to ensure deterministic, timezone-agnostic comparison.
 * 
 * @param {Date|string} workDate - The calendar date of the shift
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @returns {{ start: Date, end: Date, durationHours: number, isOvernight: boolean }}
 */
export function getShiftInterval(workDate, startTime, endTime) {
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

  const isOvernight = endTotalMinutes <= startTotalMinutes;

  // Use UTC component constructors for deterministic interval math
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  const start = new Date(Date.UTC(y, m, day, startH, startM, 0, 0));
  const end = new Date(Date.UTC(y, m, isOvernight ? day + 1 : day, endH, endM, 0, 0));

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
