import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJobSchedule,
  extractCalendarDateParts,
  formatCalendarDate,
  isJobApplicationDeadlinePassed,
  isJobWorkEnded,
  isJobWorkOngoing,
  isJobOpenForApplications,
  getEffectiveJobStatus
} from './scheduleValidation.ts';

describe('Frontend validateJobSchedule', () => {
  // Reference time: 2026-10-28 at 14:30:00 local time
  const refNow = new Date(2026, 9, 28, 14, 30, 0, 0);

  it('rejects a past work start date', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-27',
      startTime: '09:00',
      endTime: '17:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.workDate);
    assert.match(result.errors.workDate, /past/i);
  });

  it("rejects a past start time when today's date is selected", () => {
    const result = validateJobSchedule({
      workDate: '2026-10-28',
      startTime: '10:00',
      endTime: '17:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.startTime);
    assert.match(result.errors.startTime, /past/i);
  });

  it('rejects a start time equal to the current time', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-28',
      startTime: '14:30',
      endTime: '18:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.startTime);
    assert.match(result.errors.startTime, /future|current time/i);
  });

  it('accepts a valid future start time later today and future dates', () => {
    const sameDayFuture = validateJobSchedule({
      workDate: '2026-10-28',
      startTime: '14:31',
      endTime: '18:00',
      now: refNow
    });
    assert.equal(sameDayFuture.isValid, true);
    assert.equal(sameDayFuture.error, null);

    const nextDayFuture = validateJobSchedule({
      workDate: '2026-10-29',
      startTime: '09:00',
      endTime: '17:00',
      now: refNow
    });
    assert.equal(nextDayFuture.isValid, true);
    assert.equal(nextDayFuture.durationHours, 8);
  });

  it('rejects an end time earlier than the start time on the same date', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-29',
      workEndDate: '2026-10-29',
      startTime: '14:00',
      endTime: '10:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.endTime);
    assert.match(result.errors.endTime, /after/i);
  });

  it('rejects an end time equal to the start time', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-29',
      workEndDate: '2026-10-29',
      startTime: '14:00',
      endTime: '14:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.endTime);
    assert.match(result.errors.endTime, /equal|after/i);
  });

  it('allows work that continues into the next day when the end date is later than the start date', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-29',
      workEndDate: '2026-10-30',
      startTime: '22:00',
      endTime: '06:00',
      now: refNow
    });

    assert.equal(result.isValid, true);
    assert.equal(result.error, null);
    assert.equal(result.isOvernight, true);
    assert.equal(result.durationHours, 8);
  });

  it('rejects an end date earlier than the start date', () => {
    const result = validateJobSchedule({
      workDate: '2026-10-30',
      workEndDate: '2026-10-29',
      startTime: '09:00',
      endTime: '17:00',
      now: refNow
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.workEndDate);
  });

  it('normalizes YYYY-MM-DD and UTC-midnight ISO dates consistently across timezones', () => {
    const partsA = extractCalendarDateParts('2026-10-29');
    const partsB = extractCalendarDateParts('2026-10-29T00:00:00.000Z');
    assert.deepEqual(partsA, { year: 2026, monthIndex: 9, day: 29 });
    assert.deepEqual(partsB, { year: 2026, monthIndex: 9, day: 29 });
    assert.equal(formatCalendarDate('2026-10-29T00:00:00.000Z'), '2026-10-29');
  });

  it('correctly determines deadline expiration and work end status', () => {
    const job = {
      workDate: '2026-11-01',
      startTime: '09:00',
      endTime: '17:00',
      applicationDeadline: '2026-10-31T18:00:00.000Z',
      status: 'OPEN',
      openings: 2,
      filledCount: 0
    };

    const beforeDeadline = new Date('2026-10-31T12:00:00.000Z');
    const afterDeadline = new Date('2026-10-31T19:00:00.000Z');
    const midShift = new Date(2026, 10, 1, 12, 0, 0);
    const postShift = new Date(2026, 10, 1, 18, 0, 0);

    assert.equal(isJobApplicationDeadlinePassed(job, beforeDeadline), false);
    assert.equal(isJobOpenForApplications(job, beforeDeadline), true);
    assert.equal(getEffectiveJobStatus(job, beforeDeadline), 'OPEN');

    assert.equal(isJobApplicationDeadlinePassed(job, afterDeadline), true);
    assert.equal(isJobOpenForApplications(job, afterDeadline), false);
    assert.equal(getEffectiveJobStatus(job, afterDeadline), 'APPLICATIONS_CLOSED');

    assert.equal(isJobWorkOngoing(job, midShift), true);
    assert.equal(isJobWorkEnded(job, midShift), false);
    assert.equal(getEffectiveJobStatus(job, midShift), 'IN_PROGRESS');

    assert.equal(isJobWorkEnded(job, postShift), true);
    assert.equal(isJobOpenForApplications(job, postShift), false);
    assert.equal(getEffectiveJobStatus(job, postShift), 'WORK_ENDED');
  });
});

