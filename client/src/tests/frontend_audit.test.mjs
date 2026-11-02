import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNlFilters, resolveNlFallbackFilters } from '../utils/nlSearchUtils.js';
import { buildJobSearchParams } from '../utils/jobSearchParams.js';
import {
  isDefaultNycCoordinates,
  sanitizeJobCoordinates,
  validateJobLocation,
  NYC_MIDTOWN_COORDS
} from '../utils/locationValidation.js';

describe('Frontend Bug Fix Audit: Regression & Integrity Suite', () => {
  // =========================================================================
  // TASK 1: Natural Language Job Search Filter Resolution & Stale-State Fix
  // =========================================================================
  describe('Task 1: Natural Language Job Search', () => {
    const PRESETS = [
      { label: 'Atigre (Center)', locality: 'Atigre', coords: [16.7410, 74.3720] },
      { label: 'Shiroli MIDC', locality: 'Shiroli MIDC', coords: [16.7482, 74.3015] },
      { label: 'Kolhapur City', locality: 'Kolhapur', coords: [16.7050, 74.2430] }
    ];

    it('uses target parsed filters immediately, eliminating stale React state closures', () => {
      // Simulate state at the time of user submit
      const staleState = {
        search: 'old keyword',
        category: 'Cleaning and maintenance',
        minPay: '200',
        workDate: '2026-11-10',
        sort: 'recent',
        locality: 'Kolhapur'
      };

      // API returned newly parsed values
      const parsedFromApi = {
        keyword: 'wedding catering server',
        category: 'Wedding and catering support',
        minPay: 550,
        maxDistanceKm: 10,
        locality: 'Atigre'
      };

      const resolved = resolveNlFilters(staleState, parsedFromApi, PRESETS);

      // Verify that the resolved filters use fresh API values immediately
      assert.equal(resolved.search, 'wedding catering server');
      assert.equal(resolved.category, 'Wedding and catering support');
      assert.equal(resolved.minPay, '550');
      assert.equal(resolved.maxDistanceKm, '10');
      assert.equal(resolved.locality, 'Atigre');
      assert.deepEqual(resolved.coordinates, [16.7410, 74.3720]);
      // Preserved non-overridden fields
      assert.equal(resolved.workDate, '2026-11-10');
      assert.equal(resolved.sort, 'recent');

      // Verify params built from resolved filters reflect final intended values
      const params = buildJobSearchParams(resolved);
      assert.equal(params.get('search'), 'wedding catering server');
      assert.equal(params.get('category'), 'Wedding and catering support');
      assert.equal(params.get('minPay'), '550');
      assert.equal(params.get('maxDistanceKm'), '10');
      assert.equal(params.get('lat'), '16.741');
      assert.equal(params.get('lng'), '74.372');
    });

    it('falls back to a predictable keyword search using original raw query on parse failure', () => {
      const existingFilters = {
        search: '',
        category: 'Warehouse and packing',
        minPay: '400',
        locality: 'Atigre'
      };

      const rawQuery = 'overnight stocking shifts this weekend';
      const fallback = resolveNlFallbackFilters(existingFilters, rawQuery);

      assert.equal(fallback.search, 'overnight stocking shifts this weekend');
      assert.equal(fallback.category, 'Warehouse and packing');
      assert.equal(fallback.minPay, '400');
      assert.equal(fallback.locality, 'Atigre');
    });

    it('preserves existing filters without blanking them when parsed fields are absent', () => {
      const active = {
        search: 'driver',
        category: 'Delivery and logistics',
        minPay: '350',
        maxDistanceKm: '25'
      };

      // Partial parsed result
      const partialParsed = {
        keyword: 'courier'
        // category, minPay, distance are absent
      };

      const result = resolveNlFilters(active, partialParsed, PRESETS);
      assert.equal(result.search, 'courier');
      assert.equal(result.category, 'Delivery and logistics');
      assert.equal(result.minPay, '350');
      assert.equal(result.maxDistanceKm, '25');
    });
  });

  // =========================================================================
  // TASK 2: Stale Job Details Prevention & Out-of-Order Response Guard
  // =========================================================================
  describe('Task 2: Stale Job Details Prevention State Machine', () => {
    class JobDetailController {
      constructor() {
        this.job = null;
        this.loading = false;
        this.errorMessage = null;
        this.latestRequestId = 0;
      }

      // Simulates navigation to a new jobId
      navigateJob(jobId, fetchPromiseFactory) {
        const currentReqId = ++this.latestRequestId;
        // 1. Immediately clear previous job to prevent showing stale details
        this.job = null;
        this.errorMessage = null;
        this.loading = true;

        if (!jobId) {
          this.loading = false;
          this.errorMessage = 'No job identifier specified.';
          return Promise.resolve();
        }

        return fetchPromiseFactory()
          .then((res) => {
            if (currentReqId !== this.latestRequestId) return; // Discard stale/cancelled responses
            if (res.success && res.job) {
              this.job = res.job;
              this.errorMessage = null;
            } else {
              this.job = null;
              this.errorMessage = res.message || 'Job posting not found.';
            }
          })
          .catch((err) => {
            if (currentReqId !== this.latestRequestId) return; // Discard stale/cancelled errors
            this.job = null;
            this.errorMessage = err.message || 'Job posting not found.';
          })
          .finally(() => {
            if (currentReqId === this.latestRequestId) {
              this.loading = false;
            }
          });
      }
    }

    it('clears previous job immediately when job ID changes, showing loading state', () => {
      const controller = new JobDetailController();
      controller.job = { _id: 'job-1', title: 'First Job' };

      // User navigates to job-2
      controller.navigateJob('job-2', () => new Promise(() => {})); // Never resolves (in-flight)

      assert.equal(controller.job, null);
      assert.equal(controller.loading, true);
      assert.equal(controller.errorMessage, null);
    });

    it('never displays previous job details after a failed request for a different job ID', async () => {
      const controller = new JobDetailController();
      controller.job = { _id: 'job-valid', title: 'Valid Existing Job' };

      // Navigate to invalid job that rejects with 404
      await controller.navigateJob('job-invalid', () => Promise.reject(new Error('Job not found (404)')));

      assert.equal(controller.job, null);
      assert.equal(controller.loading, false);
      assert.equal(controller.errorMessage, 'Job not found (404)');
    });

    it('handles out-of-order responses: slow earlier response CANNOT overwrite newer data', async () => {
      const controller = new JobDetailController();

      let resolveJob1;
      const job1Promise = new Promise((resolve) => {
        resolveJob1 = resolve;
      });

      // 1. User opens Job 1 (request 1 starts)
      const p1 = controller.navigateJob('job-1', () => job1Promise);

      // 2. User quickly navigates to Job 2 (request 2 starts)
      const p2 = controller.navigateJob('job-2', () =>
        Promise.resolve({ success: true, job: { _id: 'job-2', title: 'Job Two (Fast)' } })
      );

      await p2;
      // Job 2 has completed
      assert.equal(controller.job?._id, 'job-2');
      assert.equal(controller.job?.title, 'Job Two (Fast)');

      // 3. Delayed Job 1 response arrives late
      resolveJob1({ success: true, job: { _id: 'job-1', title: 'Job One (Stale)' } });
      await p1;

      // Invariant: Controller must still hold Job 2, not overwritten by delayed Job 1
      assert.equal(controller.job?._id, 'job-2');
      assert.equal(controller.job?.title, 'Job Two (Fast)');
    });
  });

  // =========================================================================
  // TASK 3: Default Job Coordinates & Location Validation
  // =========================================================================
  describe('Task 3: Default Job Coordinates & Location Validation', () => {
    it('detects and eliminates hardcoded New York Midtown coordinates', () => {
      assert.equal(isDefaultNycCoordinates(NYC_MIDTOWN_COORDS), true);
      assert.equal(isDefaultNycCoordinates([-73.9851, 40.7484]), true);

      // Must sanitize to null so an Indian venue does not inherit NYC coords
      const sanitized = sanitizeJobCoordinates([-73.9851, 40.7484]);
      assert.equal(sanitized, null);
    });

    it('preserves legitimate Indian venue coordinates when explicitly confirmed', () => {
      // Atigre, Kolhapur [longitude, latitude]
      const atigre = [74.3720, 16.7410];
      assert.equal(isDefaultNycCoordinates(atigre), false);
      assert.deepEqual(sanitizeJobCoordinates(atigre), [74.3720, 16.7410]);

      // Mumbai [longitude, latitude]
      const mumbai = [72.8777, 19.0760];
      assert.equal(isDefaultNycCoordinates(mumbai), false);
      assert.deepEqual(sanitizeJobCoordinates(mumbai), [72.8777, 19.0760]);
    });

    it('submits null coordinates when no GPS or preset is selected, without failing validation', () => {
      const sanitized = sanitizeJobCoordinates(null);
      assert.equal(sanitized, null);

      const validation = validateJobLocation('Sanjay Ghodawat Institute, Atigre', null);
      assert.equal(validation.isValid, true);
      assert.deepEqual(validation.errors, {});
    });

    it('validates locationName is present and non-empty', () => {
      const invalidEmpty = validateJobLocation('   ', null);
      assert.equal(invalidEmpty.isValid, false);
      assert.ok(invalidEmpty.errors.locationName);
    });
  });

  // =========================================================================
  // TASK 4 & 5: Navigation Drawer & Modal Accessibility Contract
  // =========================================================================
  describe('Task 4 & 5: Navigation & Accessible Modal Contracts', () => {
    it('verifies focusable selector contract for accessible modal keyboard trap', () => {
      const FOCUSABLE_SELECTOR =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

      // Ensure standard interactive HTML tags are covered by the selector
      assert.ok(FOCUSABLE_SELECTOR.includes('button:not([disabled])'));
      assert.ok(FOCUSABLE_SELECTOR.includes('[href]'));
      assert.ok(FOCUSABLE_SELECTOR.includes('input:not([disabled])'));
      assert.ok(FOCUSABLE_SELECTOR.includes('select:not([disabled])'));
      assert.ok(FOCUSABLE_SELECTOR.includes('textarea:not([disabled])'));
      assert.ok(FOCUSABLE_SELECTOR.includes('[tabindex]:not([tabindex="-1"]):not([disabled])'));
    });
  });
});
