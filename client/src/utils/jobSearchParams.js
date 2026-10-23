/** Builds the shared /jobs query, prioritizing a coordinate radius over exact place names. */
export function buildJobSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.minPay) params.set('minPay', filters.minPay);
  if (filters.workDate) params.set('workDate', filters.workDate);
  if (filters.maxDistanceKm) params.set('maxDistanceKm', filters.maxDistanceKm);
  if (filters.sort) params.set('sort', filters.sort);

  const hasCoordinates = Boolean(
    filters.coordinates &&
    filters.coordinates.length === 2 &&
    filters.coordinates.every(Number.isFinite)
  );
  const hasRadiusOrigin = Boolean(filters.maxDistanceKm && hasCoordinates);

  // A radius is centered on its coordinates; keeping an exact locality predicate
  // would incorrectly discard eligible jobs in neighboring localities.
  if (!hasRadiusOrigin) {
    if (filters.location?.trim()) params.set('location', filters.location.trim());
    else if (filters.locality?.trim()) params.set('locality', filters.locality.trim());
  }

  if (hasCoordinates) {
    params.set('lat', String(filters.coordinates[0]));
    params.set('lng', String(filters.coordinates[1]));
  }

  return params;
}