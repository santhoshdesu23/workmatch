import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildJobSearchParams } from './jobSearchParams.js';

describe('buildJobSearchParams', () => {
  it('sends homepage location with existing search filters', () => {
    const params = buildJobSearchParams({
      search: 'packing',
      category: 'Warehouse and packing',
      location: 'Atigre',
      sort: 'recent'
    });

    assert.equal(params.get('location'), 'Atigre');
    assert.equal(params.get('search'), 'packing');
    assert.equal(params.get('category'), 'Warehouse and packing');
  });

  it('sends radius and coordinates without retaining an exact locality constraint', () => {
    const params = buildJobSearchParams({
      locality: 'Atigre',
      maxDistanceKm: '10',
      coordinates: [16.741, 74.372]
    });

    assert.equal(params.get('maxDistanceKm'), '10');
    assert.equal(params.get('lat'), '16.741');
    assert.equal(params.get('lng'), '74.372');
    assert.equal(params.has('locality'), false);
  });

  it('preserves exact locality browsing when no radius is selected', () => {
    const params = buildJobSearchParams({ locality: 'Atigre', coordinates: [16.741, 74.372] });
    assert.equal(params.get('locality'), 'Atigre');
    assert.equal(params.has('maxDistanceKm'), false);
  });
});