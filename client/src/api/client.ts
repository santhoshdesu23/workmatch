import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1000, 2000];

/**
 * Determines whether a failed request is eligible for automatic retry.
 * Only GET requests encountering transient network errors, timeouts, or 502/503/504 responses are retried.
 * Normal 4xx errors (404, 403, 401) and non-GET requests are never automatically retried.
 */
export function isRetryableError(error: AxiosError | any): boolean {
  if (!error || !error.config) return false;

  // Never retry if request was aborted / cancelled (e.g., component unmounted)
  if (error.config.signal?.aborted || axios.isCancel(error)) {
    return false;
  }

  // Only retry idempotent GET requests
  const method = (error.config.method || 'get').toLowerCase();
  if (method !== 'get') {
    return false;
  }

  // Network failures with no response (e.g. ECONNRESET, network down, server restarting)
  if (!error.response) {
    return true;
  }

  // Client timeouts
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return true;
  }

  // Selected transient server-side 5xx responses
  const status = error.response.status;
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  return false;
}

const api = axios.create({
  baseURL: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError | any) => {
    const config = error.config as RetryConfig | undefined;

    // Evaluate controlled retry with exponential backoff
    if (config && isRetryableError(error)) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[config._retryCount] || 2000;
        config._retryCount += 1;

        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            if (config.signal && typeof (config.signal as any).addEventListener === 'function') {
              (config.signal as any).addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  reject(new Error('Request was cancelled.'));
                },
                { once: true }
              );
            }
          });

          // Check again in case abort occurred during delay
          if (config.signal?.aborted) {
            return Promise.reject(new Error('Request was cancelled.'));
          }

          return api(config);
        } catch (abortErr) {
          return Promise.reject(abortErr);
        }
      }
    }

    let message = 'An unexpected network error occurred.';

    if (error.response) {
      const data: any = error.response.data;
      if (typeof data === 'string' && data.length < 200 && !data.includes('<!DOCTYPE')) {
        message = data;
      } else if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (error.response.status === 409) {
        message = 'An account with this email address already exists. Please log in.';
      } else if (error.response.status === 401) {
        message = 'Authentication required or session expired. Please log in.';
      } else if (error.response.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (error.response.status === 404) {
        message = 'The requested resource was not found.';
      } else if (error.response.status >= 500) {
        message = 'Server encountered an error. Please try again.';
      } else {
        message = error.message || 'An error occurred with your request.';
      }
    } else if (error.request) {
      message = 'Cannot connect to server. Please ensure the backend is running.';
    } else {
      message = error.message || message;
    }

    const customErr: any = new Error(message);
    customErr.status = error.response?.status;
    customErr.data = error.response?.data;
    customErr.code = error.response?.data?.code || error.code;
    return Promise.reject(customErr);
  }
);

export default api;
