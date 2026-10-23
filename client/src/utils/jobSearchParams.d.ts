export interface JobSearchFilters {
  search?: string;
  category?: string;
  minPay?: string;
  workDate?: string;
  maxDistanceKm?: string;
  sort?: string;
  location?: string;
  locality?: string;
  coordinates?: [number, number] | null;
}

export function buildJobSearchParams(filters: JobSearchFilters): URLSearchParams;
