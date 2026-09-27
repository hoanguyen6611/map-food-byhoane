import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { HCMC_CENTER, type LatLng } from '../lib/geo';

// How long we're willing to wait on a GPS fix before treating it as a
// timeout and falling back to HCMC_CENTER — same budget MapScreen used
// before this logic was factored out (build-prompts/03's "GPS timeout ->
// fallback thủ công" spec).
const LOCATION_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface DeviceLocationState {
  /** Real device coordinates once resolved, or `null` if denied/unavailable/timed out. */
  location: LatLng | null;
  /** `location` when available, else `HCMC_CENTER` — always a usable center. */
  effectiveCenter: LatLng;
  /** True once the initial permission + position check has settled (either way). */
  isResolved: boolean;
  /** True if we fell back to `HCMC_CENTER` (permission denied, or the GPS fix timed out). */
  isFallback: boolean;
  /** True while a `refresh()` call is in flight. */
  isRefreshing: boolean;
  /**
   * Re-prompts for permission (if not yet granted) and re-fetches a fresh
   * GPS fix — e.g. MapScreen's "locate me" button, so a denial at boot (or a
   * timed-out fix) isn't a dead end for the rest of the session. Resolves
   * with the fresh coordinate directly (not just via the `location` state
   * field) so a caller can act on it immediately without waiting a render.
   */
  refresh: () => Promise<LatLng | null>;
}

/**
 * Shared "get current device location, or fall back to HCMC center" check.
 * Factored out of `MapScreen`'s original inline implementation
 * (build-prompts/03) so `ListScreen` (build-prompts/04) doesn't need a second
 * independent permission-request flow. The initial mount-time check only
 * *checks* the current permission state (mirrors `MapScreen`'s note that
 * `PermissionLocationScreen` already requested it once at boot) — it does
 * not itself prompt the user; `refresh()` is the one path that does.
 */
export function useDeviceLocation(): DeviceLocationState {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const resolve = useCallback(async (requestPermission: boolean): Promise<LatLng | null> => {
    try {
      const permission = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error('permission not granted');
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
      );
      const resolved = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!mountedRef.current) return resolved;

      setLocation(resolved);
      setIsFallback(false);
      return resolved;
    } catch {
      if (mountedRef.current) {
        setLocation(null);
        setIsFallback(true);
      }
      return null;
    } finally {
      if (mountedRef.current) setIsResolved(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    resolve(false);
    return () => {
      mountedRef.current = false;
    };
  }, [resolve]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      return await resolve(true);
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [resolve]);

  return {
    location,
    effectiveCenter: location ?? HCMC_CENTER,
    isResolved,
    isFallback,
    isRefreshing,
    refresh,
  };
}
