import { useEffect, useState } from 'react';
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
}

/**
 * Shared "get current device location, or fall back to HCMC center" check.
 * Factored out of `MapScreen`'s original inline implementation
 * (build-prompts/03) so `ListScreen` (build-prompts/04) doesn't need a second
 * independent permission-request flow. Only *checks* the current permission
 * state (mirrors `MapScreen`'s note that `PermissionLocationScreen` already
 * requested it once at boot) — it does not itself prompt the user.
 */
export function useDeviceLocation(): DeviceLocationState {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          throw new Error('permission not granted');
        }

        const position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          LOCATION_TIMEOUT_MS,
        );
        if (cancelled) return;

        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setIsFallback(false);
      } catch {
        if (cancelled) return;
        setLocation(null);
        setIsFallback(true);
      } finally {
        if (!cancelled) setIsResolved(true);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    location,
    effectiveCenter: location ?? HCMC_CENTER,
    isResolved,
    isFallback,
  };
}
