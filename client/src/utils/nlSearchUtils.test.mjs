import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNlFilters, resolveNlFallbackFilters } from './nlSearchUtils.js';

describe('Natural Language Search Filter Resolution', () => {
  const LOCALITY_PRESETS = [
    { label: 'All Locations', locality: '', coords: null },
    { label: 'Atigre (Center)', locality: 'Atigre', coords: [16.7410, 74.3720] },
    { label: 'Shiroli MIDC', locality: 'Shiroli MIDC', coords: [16.7482, 74.3015] },
    { label: 'Kolhapur City', locality: 'Kolhapur', coords: [16.7050, 74.2430] }
  ];

  it('correctly applies all parsed NLP filters including preset coordinates', () => {
    const current = {
      search: '',
      category: '',
      minPay: '',
      workDate: '2026-11-15',
      maxDistanceKm: '',
      sort: 'recent',
      location: '',
      locality: '',
      coordinates: null
    };

    const parsed = {
      keyword: 'warehouse packing',
      category: 'Warehouse and packing',
      minPay: 500,
      maxDistanceKm: 15,
      locality: 'Atigre',
      source: 'AI NLP Parser'
    };

    const result = resolveNlFilters(current, parsed, LOCALITY_PRESETS);

    assert.equal(result.search, 'warehouse packing');
    assert.equal(result.category, 'Warehouse and packing');
    assert.equal(result.minPay, '500');
    assert.equal(result.maxDistanceKm, '15');
    assert.equal(result.locality, 'Atigre');
    assert.deepEqual(result.coordinates, [16.7410, 74.3720]);
    // Preserves unrelated filters like workDate and sort
    assert.equal(result.workDate, '2026-11-15');
    assert.equal(result.sort, 'recent');
  });

  it('preserves existing filters when some parsed fields are absent or null', () => {
    const current = {
      search: 'electrician',
      category: 'Construction and maintenance',
      minPay: '400',
      workDate: '2026-11-20',
      maxDistanceKm: '20',
      sort: 'pay_high',
      location: '',
      locality: 'Kolhapur',
      coordinates: [16.7050, 74.2430]
    };

    // User asks only to change the category and keyword, omitting pay, locality, distance
    const parsed = {
      keyword: 'supervisor',
      category: 'Retail and store assistance',
      minPay: null,
      maxDistanceKm: undefined,
      locality: ''
    };

    const result = resolveNlFilters(current, parsed, LOCALITY_PRESETS);

    assert.equal(result.search, 'supervisor');
    assert.equal(result.category, 'Retail and store assistance');
    // Existing values must NOT be overwritten with null/empty
    assert.equal(result.minPay, '400');
    assert.equal(result.maxDistanceKm, '20');
    assert.equal(result.locality, 'Kolhapur');
    assert.deepEqual(result.coordinates, [16.7050, 74.2430]);
  });

  it('falls back to a predictable keyword search using raw query on NLP failure', () => {
    const current = {
      search: '',
      category: 'Cleaning and maintenance',
      minPay: '300',
      workDate: '',
      sort: 'recent',
      locality: 'Atigre'
    };

    const rawQuery = 'urgent dishwashing shift tonight';
    const fallback = resolveNlFallbackFilters(current, rawQuery);

    assert.equal(fallback.search, 'urgent dishwashing shift tonight');
    // Preserves existing category, minPay, locality
    assert.equal(fallback.category, 'Cleaning and maintenance');
    assert.equal(fallback.minPay, '300');
    assert.equal(fallback.locality, 'Atigre');
  });

  it('prevents stale closure state by creating a fresh target filter object for the network call', () => {
    // Simulate stale state: current React state is empty
    const stateAtTimeOfSubmit = {
      search: 'old keyword',
      category: 'Old Category',
      minPay: '100'
    };

    const parsedFromApi = {
      keyword: 'night security',
      category: 'Security and protective services',
      minPay: 600
    };

    // The resolver builds the target object directly from parsed output
    const target = resolveNlFilters(stateAtTimeOfSubmit, parsedFromApi, LOCALITY_PRESETS);

    // If an API request is made with target, it uses the fresh values immediately
    assert.equal(target.search, 'night security');
    assert.equal(target.category, 'Security and protective services');
    assert.equal(target.minPay, '600');
    assert.notEqual(target.search, stateAtTimeOfSubmit.search);
  });
});
