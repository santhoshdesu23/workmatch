export interface JobFilterState {
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

export interface NlParsedResult {
  keyword?: string | null;
  category?: string | null;
  minPay?: number | string | null;
  maxDistanceKm?: number | string | null;
  locality?: string | null;
  source?: string;
}

export interface LocalityPreset {
  label?: string;
  locality: string;
  coords: [number, number] | null;
}

export function resolveNlFilters(
  currentFilters?: JobFilterState,
  parsed?: NlParsedResult | null,
  presets?: LocalityPreset[]
): JobFilterState;

export function resolveNlFallbackFilters(
  currentFilters?: JobFilterState,
  rawQuery?: string
): JobFilterState;
