/**
 * WorkMatch Name Validation Utility
 *
 * Rules:
 * - Separate First Name and Last Name fields.
 * - Maximum length: 30 characters per field.
 * - Minimum length: 1 character (required).
 * - Trim leading and trailing whitespace before validation and persistence.
 * - Preserves valid spaces, hyphens, apostrophes, periods, and unicode letters across international naming conventions.
 */

export const MAX_NAME_LENGTH = 30;

// Matches unicode letters, combining marks, hyphens, apostrophes (straight and curly), periods, and spaces
export const NAME_REGEX = /^[\p{L}\p{M}'’\-\. ]+$/u;

/**
 * Validates a single name field (first name or last name).
 * @param {unknown} value - Value to validate
 * @param {string} fieldLabel - Display label for error messages (e.g. 'First name', 'Last name')
 * @returns {string|null} Error message if invalid, or null if valid.
 */
export function validateNameField(value, fieldLabel = 'Name') {
  if (value === undefined || value === null) {
    return `${fieldLabel} is required.`;
  }

  if (typeof value !== 'string') {
    return `${fieldLabel} must be a valid text string.`;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return `${fieldLabel} is required.`;
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return `${fieldLabel} cannot exceed ${MAX_NAME_LENGTH} characters.`;
  }

  if (!NAME_REGEX.test(trimmed)) {
    return `${fieldLabel} can only contain letters, spaces, hyphens, and apostrophes.`;
  }

  return null;
}
