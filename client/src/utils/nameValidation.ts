/**
 * WorkMatch Frontend Name Validation Utilities
 */

export const MAX_NAME_LENGTH = 30;

// Preserves international unicode letters, combining marks, spaces, hyphens, apostrophes (straight & curly), and periods
export const NAME_REGEX = /^[\p{L}\p{M}'’\-\. ]+$/u;

export interface NameValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validates a first or last name field.
 * - Required (non-empty after trim)
 * - Maximum 30 characters
 * - Supports legitimate name characters (hyphens, apostrophes, spaces, periods, unicode)
 */
export function validateName(value: string, fieldLabel = 'Name'): NameValidationResult {
  if (value === undefined || value === null) {
    return { isValid: false, error: `${fieldLabel} is required.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { isValid: false, error: `${fieldLabel} is required.` };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { isValid: false, error: `${fieldLabel} cannot exceed ${MAX_NAME_LENGTH} characters.` };
  }

  if (!NAME_REGEX.test(trimmed)) {
    return { isValid: false, error: `${fieldLabel} can only contain letters, spaces, hyphens, and apostrophes.` };
  }

  return { isValid: true, error: null };
}

/**
 * Truncates and sanitizes pasted text safely so value never exceeds the character limit.
 */
export function sanitizePastedName(text: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (!text) return '';
  return text.slice(0, maxLength);
}
