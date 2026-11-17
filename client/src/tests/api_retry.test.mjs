import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableError } from '../api/client.ts';

describe('API Controlled Retry Policy Suite', () => {
  it('retries temporary network errors on GET requests (no response)', () => {
    const error = {
      config: { method: 'get' }
      // no error.response simulates network failure
    };
    assert.equal(isRetryableError(error), true);
  });

  it('retries timeout errors on GET requests', () => {
    const error = {
      code: 'ECONNABORTED',
      message: 'timeout of 15000ms exceeded',
      config: { method: 'get' }
    };
    assert.equal(isRetryableError(error), true);
  });

  it('retries 502, 503, and 504 server errors on GET requests', () => {
    [502, 503, 504].forEach((status) => {
      const error = {
        config: { method: 'get' },
        response: { status }
      };
      assert.equal(isRetryableError(error), true, `Expected status ${status} to be retryable`);
    });
  });

  it('does NOT retry 404 Not Found errors', () => {
    const error = {
      config: { method: 'get' },
      response: { status: 404 }
    };
    assert.equal(isRetryableError(error), false);
  });

  it('does NOT retry 401 Unauthorized or 403 Forbidden errors', () => {
    [401, 403].forEach((status) => {
      const error = {
        config: { method: 'get' },
        response: { status }
      };
      assert.equal(isRetryableError(error), false);
    });
  });

  it('does NOT retry 400 Bad Request or 409 Conflict errors', () => {
    [400, 409].forEach((status) => {
      const error = {
        config: { method: 'get' },
        response: { status }
      };
      assert.equal(isRetryableError(error), false);
    });
  });

  it('does NOT retry non-GET requests (POST, PATCH, PUT, DELETE)', () => {
    ['post', 'patch', 'put', 'delete'].forEach((method) => {
      const error = {
        config: { method }
        // network failure, but unsafe method
      };
      assert.equal(isRetryableError(error), false, `Expected ${method} to not be automatically retried`);
    });
  });

  it('does NOT retry when request has been aborted or cancelled', () => {
    const error = {
      config: {
        method: 'get',
        signal: { aborted: true }
      }
    };
    assert.equal(isRetryableError(error), false);
  });
});
