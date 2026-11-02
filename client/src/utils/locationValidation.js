/**
 * Location validation and coordinate sanitization utilities for WorkMatch job postings.
 */

// Midtown NYC coordinates that were previously used as a hardcoded default
export const NYC_MIDTOWN_COORDS = [-73.9851, 40.7484];

/**
 * Checks whether the given coordinates match the legacy NYC default coordinates.
 *
 * @param {Array<number>|null|undefined} coords - [longitude, latitude]
 * @returns {boolean}
 */
export function isDefaultNycCoordinates(coords) {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return Math.abs(Number(lng) - NYC_MIDTOWN_COORDS[0]) < 0.01 &&
         Math.abs(Number(lat) - NYC_MIDTOWN_COORDS[1]) < 0.01;
}

/**
 * Sanitizes coordinates for job submission:
 * - Rejects non-arrays, non-numeric values, or out-of-bounds coordinates.
 * - Filters out accidental NYC default coordinates.
 * - Returns null if coordinates were not deliberately selected or confirmed.
 *
 * @param {Array<number>|null|undefined} coords - [longitude, latitude]
 * @returns {[number, number]|null}
 */
export function sanitizeJobCoordinates(coords) {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) {
    return null;
  }
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null;
  }
  if (isDefaultNycCoordinates([lng, lat])) {
    return null;
  }
  return [lng, lat];
}

/**
 * Validates employer location input before submitting or moving to the next step.
 *
 * @param {string} locationName - The entered text address or venue name
 * @param {Array<number>|null|undefined} coordinates - [longitude, latitude]
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateJobLocation(locationName, coordinates) {
  const errors = {};
  const trimmed = String(locationName || '').trim();

  if (!trimmed || trimmed.length < 3) {
    errors.locationName = 'Location address or venue description is required (at least 3 characters).';
  }

  if (isDefaultNycCoordinates(coordinates)) {
    errors.coordinates = 'Default New York coordinates detected. Please confirm actual venue location or clear GPS.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
