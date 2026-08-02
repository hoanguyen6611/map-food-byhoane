// Per docs/01-prd-mvp.md §10.2 business rule: default 3km search radius,
// hard cap 20km regardless of what's requested. Extracted as a standalone
// pure function so the clamp behavior itself is unit-testable without
// spinning up the full service/database (see restaurant.util.spec.ts).
export const DEFAULT_RADIUS_KM = 3;
export const MAX_RADIUS_KM = 20;

export function clampRadiusKm(requestedKm?: number): number {
  return Math.min(requestedKm ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM);
}
