import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDefaultNycCoordinates,
  sanitizeJobCoordinates,
  validateJobLocation,
  NYC_MIDTOWN_COORDS
} from './locationValidation.js';

describe('Job Location & Coordinate Validation', () => {
  it('detects legacy New York Midtown default coordinates', () => {
    assert.equal(isDefaultNycCoordinates(NYC_MIDTOWN_COORDS), true);
    assert.equal(isDefaultNycCoordinates([-73.9851, 40.7484]), true);
    // Slight float variations
    assert.equal(isDefaultNycCoordinates([-73.985, 40.748]), true);
  });

  it('does NOT misidentify Indian or global coordinates as NYC', () => {
    // Atigre, Kolhapur [longitude, latitude]
    assert.equal(isDefaultNycCoordinates([74.3720, 16.7410]), false);
    // Mumbai [longitude, latitude]
    assert.equal(isDefaultNycCoordinates([72.8777, 19.0760]), false);
    // Null or undefined
    assert.equal(isDefaultNycCoordinates(null), false);
    assert.equal(isDefaultNycCoordinates(undefined), false);
  });

  it('sanitizes legacy NYC coordinates to null so an Indian venue cannot inherit them', () => {
    const sanitized = sanitizeJobCoordinates(NYC_MIDTOWN_COORDS);
    assert.equal(sanitized, null);
  });

  it('preserves deliberately confirmed valid Indian venue coordinates', () => {
    const atigreCoords = [74.3720, 16.7410];
    const sanitized = sanitizeJobCoordinates(atigreCoords);
    assert.deepEqual(sanitized, [74.3720, 16.7410]);
  });

  it('sanitizes missing, null, or malformed coordinates safely to null', () => {
    assert.equal(sanitizeJobCoordinates(null), null);
    assert.equal(sanitizeJobCoordinates(undefined), null);
    assert.equal(sanitizeJobCoordinates([]), null);
    assert.equal(sanitizeJobCoordinates(['invalid', 'coords']), null);
    assert.equal(sanitizeJobCoordinates([999, 999]), null); // Out of bounds
  });

  it('validates location name presence and rejects NYC coordinates', () => {
    // Empty location name is invalid
    const emptyCheck = validateJobLocation('', [74.3720, 16.7410]);
    assert.equal(emptyCheck.isValid, false);
    assert.ok(emptyCheck.errors.locationName);

    // Valid location with NYC coordinates is flagged
    const nycCheck = validateJobLocation('Sanjay Ghodawat Institute, Atigre', NYC_MIDTOWN_COORDS);
    assert.equal(nycCheck.isValid, false);
    assert.ok(nycCheck.errors.coordinates);

    // Valid location with valid Indian coordinates passes
    const validCheck = validateJobLocation('Sanjay Ghodawat Institute, Atigre', [74.3720, 16.7410]);
    assert.equal(validCheck.isValid, true);
    assert.deepEqual(validCheck.errors, {});

    // Valid location with null coordinates (text-only) passes
    const textOnlyCheck = validateJobLocation('Bandra Kurla Complex, Mumbai', null);
    assert.equal(textOnlyCheck.isValid, true);
    assert.deepEqual(textOnlyCheck.errors, {});
  });
});
