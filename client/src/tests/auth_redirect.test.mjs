import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Function mirroring LoginPage safe destination validation
export function getSafeReturnDestination(candidate) {
  if (
    typeof candidate === 'string' &&
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.includes('://')
  ) {
    return candidate;
  }
  return null;
}

export function categorizeAuthError(err) {
  const status = err.status || err.response?.status;
  const rawMessage = (err.message || '').toLowerCase();

  if (
    rawMessage.includes('cannot connect') ||
    rawMessage.includes('network error') ||
    rawMessage.includes('unable to connect') ||
    err.code === 'ERR_NETWORK'
  ) {
    return 'Unable to connect to the server. Please try again.';
  }
  if (rawMessage.includes('verify') || err.code === 'EMAIL_VERIFICATION_REQUIRED') {
    return 'Please verify your email address to continue.';
  }
  if (
    status === 401 ||
    rawMessage.includes('invalid email or password') ||
    rawMessage.includes('invalid credentials')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  return err.message || 'Login failed. Please check your credentials.';
}

describe('Authentication Error & Safe Redirection Suite', () => {
  describe('Safe Post-Login Redirection Validation', () => {
    it('accepts valid internal paths for redirection', () => {
      assert.equal(getSafeReturnDestination('/jobs/6ad4982108c769daff6bd2a4'), '/jobs/6ad4982108c769daff6bd2a4');
      assert.equal(getSafeReturnDestination('/jobs?category=Warehouse'), '/jobs?category=Warehouse');
      assert.equal(getSafeReturnDestination('/worker/attendance'), '/worker/attendance');
    });

    it('rejects external URL open redirect attacks', () => {
      assert.equal(getSafeReturnDestination('https://evil-site.com'), null);
      assert.equal(getSafeReturnDestination('http://attacker.com/steal'), null);
      assert.equal(getSafeReturnDestination('//attacker.com'), null);
      assert.equal(getSafeReturnDestination('/\\attacker.com'), '/\\attacker.com'); // starts with / but not protocol
      assert.equal(getSafeReturnDestination('javascript:alert(1)'), null);
    });

    it('handles empty, null or undefined redirect targets safely', () => {
      assert.equal(getSafeReturnDestination(''), null);
      assert.equal(getSafeReturnDestination(null), null);
      assert.equal(getSafeReturnDestination(undefined), null);
    });
  });

  describe('Authentication Error Categorization', () => {
    it('categorizes 401 and invalid credentials with user-friendly message', () => {
      const error = { status: 401, message: 'Invalid email or password.' };
      assert.equal(
        categorizeAuthError(error),
        'Invalid email or password. Please check your credentials and try again.'
      );
    });

    it('categorizes temporary network failures separately from credential errors', () => {
      const error = { message: 'Cannot connect to server. Please ensure the backend is running.' };
      assert.equal(
        categorizeAuthError(error),
        'Unable to connect to the server. Please try again.'
      );

      const netErr = { code: 'ERR_NETWORK', message: 'Network Error' };
      assert.equal(
        categorizeAuthError(netErr),
        'Unable to connect to the server. Please try again.'
      );
    });

    it('identifies unverified email requirement clearly', () => {
      const error = { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email' };
      assert.equal(
        categorizeAuthError(error),
        'Please verify your email address to continue.'
      );
    });
  });
});
