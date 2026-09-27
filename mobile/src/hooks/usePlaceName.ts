import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '../lib/geo';

/**
 * Reverse-geocodes a device coordinate into a short, human-readable place
 * name (district, falling back to broader subregion/city/region) — used by
 * HomeScreen's greeting, which used to show a hardcoded "TP. Hồ Chí Minh"
 * regardless of where the device actually was. Returns `null` while
 * resolving, on denial, or if reverse geocoding fails/returns nothing —
 * callers fall back to a static default in that case, same "honest gap,
 * never a fabricated value" convention as ProfileScreen's stats.
 */
export function usePlaceName(location: LatLng | null): string | null {
  const [placeName, setPlaceName] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setPlaceName(null);
      return;
    }

    let cancelled = false;

    Location.reverseGeocodeAsync(location)
      .then((results) => {
        if (cancelled) return;
        const first = results[0];
        setPlaceName(first?.district || first?.subregion || first?.city || first?.region || null);
      })
      .catch(() => {
        if (!cancelled) setPlaceName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location?.latitude, location?.longitude]);

  return placeName;
}
