/**
 * Pure utilities for resolving natural language search parsed filters
 * against current React state without stale closures or empty overwrites.
 */

/**
 * Resolves new filter values by merging parsed NLP/AI output with current filter state.
 * Preserves existing filters unless the parsed output explicitly provides a non-empty value.
 *
 * @param {Object} currentFilters - The current active filter state
 * @param {Object|null|undefined} parsed - The parsed NLP result from /recommendations/nl-search
 * @param {Array} presets - Locality presets with coordinates
 * @returns {Object} The resolved next filter state
 */
export function resolveNlFilters(currentFilters = {}, parsed = null, presets = []) {
  if (!parsed || typeof parsed !== 'object') {
    return { ...currentFilters };
  }

  const nextFilters = { ...currentFilters };

  // 1. Keyword: update only if non-empty string provided
  if (parsed.keyword !== undefined && parsed.keyword !== null && String(parsed.keyword).trim() !== '') {
    nextFilters.search = String(parsed.keyword).trim();
  }

  // 2. Category: update only if non-empty string provided
  if (parsed.category !== undefined && parsed.category !== null && String(parsed.category).trim() !== '') {
    nextFilters.category = String(parsed.category).trim();
  }

  // 3. Minimum pay: update only if valid non-empty number or string
  if (parsed.minPay !== undefined && parsed.minPay !== null && String(parsed.minPay).trim() !== '') {
    nextFilters.minPay = String(parsed.minPay).trim();
  }

  // 4. Maximum distance: update only if valid non-empty number or string
  if (parsed.maxDistanceKm !== undefined && parsed.maxDistanceKm !== null && String(parsed.maxDistanceKm).trim() !== '') {
    nextFilters.maxDistanceKm = String(parsed.maxDistanceKm).trim();
  }

  // 5. Locality and coordinates: update consistently if provided
  if (parsed.locality !== undefined && parsed.locality !== null && String(parsed.locality).trim() !== '') {
    const trimmedLocality = String(parsed.locality).trim();
    nextFilters.locality = trimmedLocality;
    nextFilters.location = ''; // Clear raw text query in favor of structured locality
    if (Array.isArray(presets)) {
      const preset = presets.find(
        (p) => p && typeof p.locality === 'string' && p.locality.toLowerCase() === trimmedLocality.toLowerCase()
      );
      if (preset && preset.coords) {
        nextFilters.coordinates = preset.coords;
      }
    }
  }

  return nextFilters;
}

/**
 * Fallback resolver when natural language parsing fails or returns invalid data.
 * Falls back to a predictable keyword search using the raw user query while preserving existing filters.
 *
 * @param {Object} currentFilters - The current active filter state
 * @param {string} rawQuery - The original user search string
 * @returns {Object} The resolved fallback filter state
 */
export function resolveNlFallbackFilters(currentFilters = {}, rawQuery = '') {
  return {
    ...currentFilters,
    search: String(rawQuery || '').trim()
  };
}
