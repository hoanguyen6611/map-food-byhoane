/**
 * Geospatial helpers for the Home Map screen (docs/build-prompts/03-map-geospatial.md).
 * No native/geo library needed — plain math is enough for viewport bounds
 * derivation and a client-side haversine distance.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** A `react-native-maps` `Region`, as delivered by `onRegionChangeComplete`. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface BoundsBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

/**
 * Derives the SW/NE bounding box of a map viewport region for use as a
 * `GET /restaurants/bounds` query, per build-prompts/03 task 3.
 */
export function regionToBounds(region: MapRegion): BoundsBox {
  const latHalf = Math.abs(region.latitudeDelta) / 2;
  const lngHalf = Math.abs(region.longitudeDelta) / 2;
  return {
    swLat: region.latitude - latHalf,
    swLng: region.longitude - lngHalf,
    neLat: region.latitude + latHalf,
    neLng: region.longitude + lngHalf,
  };
}

/**
 * Rounds a bounding box to ~11m precision (4 decimal places). Small pans
 * during the debounce window collapse onto the same React Query cache key,
 * mirroring the backend's "rounded bounds" viewport cache key
 * (docs/05-system-architecture.md §8) instead of hand-rolling extra caching.
 */
export function roundBounds(bounds: BoundsBox): BoundsBox {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    swLat: round(bounds.swLat),
    swLng: round(bounds.swLng),
    neLat: round(bounds.neLat),
    neLng: round(bounds.neLng),
  };
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine great-circle distance in meters. `GET /restaurants/bounds`
 * always returns `distanceMeters: null` (no single reference point for a
 * bounding box — see shared-types/restaurant.ts), so the Home Map screen
 * computes distance client-side against the device's current position using
 * this helper instead.
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

/** Ho Chi Minh City center — fallback map center when location is unavailable. */
export const HCMC_CENTER: LatLng = { latitude: 10.7769, longitude: 106.7009 };

/** ~5.5km viewport span, wide enough to show the default 3km nearby radius. */
export const DEFAULT_REGION_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };
