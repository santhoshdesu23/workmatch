export const NYC_MIDTOWN_COORDS: [number, number];

export function isDefaultNycCoordinates(coords?: [number, number] | number[] | null): boolean;

export function sanitizeJobCoordinates(coords?: [number, number] | number[] | null): [number, number] | null;

export function validateJobLocation(
  locationName?: string,
  coordinates?: [number, number] | number[] | null
): {
  isValid: boolean;
  errors: Record<string, string>;
};
