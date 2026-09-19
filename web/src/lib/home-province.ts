// Persists the Home page's selected province across reloads/visits (per
// the user's explicit request — a URL query param would reset the moment
// they navigate back to "/", a cookie survives that). Server-only (like
// ./auth.ts) — `getHomeProvince` is safe to call from the Home Server
// Component's render; `setHomeProvince` may only run inside a Server Action
// (see app/[locale]/actions.ts), matching Next.js's `cookies().set()` rule.
import { cookies } from 'next/headers';
import type { MeResponse } from '@foodmap/shared-types';
import { VN_PROVINCES } from '@foodmap/shared-types';
import { getSession, backendFetchAuthorized } from './auth';

const HOME_PROVINCE_COOKIE = 'fm_home_province';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// The dataset's own HCMC entry (code '79') — every write path (add-restaurant
// forms on web/admin-web/mobile, profile's homeCity select) already saves
// this exact string when someone picks Ho Chi Minh City, so this is what
// every province-scoped fetch on the site must default to as well. (Older
// rows were seeded with the abbreviated "TP. Hồ Chí Minh" literal before
// this dataset was adopted app-wide — those get backfilled to this string
// rather than the other way around, since every live write path already
// produces this one.)
export const HCMC_DATASET_CODE = '79';
export const HCMC_PROVINCE_NAME = VN_PROVINCES.find((p) => p.code === HCMC_DATASET_CODE)!.name;

/** Cheap check first (`getSession` just reads a cookie) — the `/me` round-trip only happens for a signed-in visitor, and only once there's no explicit cookie choice to use instead. */
async function getProfileHomeCity(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const res = await backendFetchAuthorized('/me');
  if (!res || !res.ok) return null;
  const me = (await res.json()) as MeResponse;
  return me.profile.homeCity;
}

/**
 * Resolves the site's default province (Home, Search, Map all call this).
 * Precedence: an explicit cookie choice (this session or a past visit) wins
 * outright; otherwise, for a signed-in visitor, their profile's saved
 * province; otherwise the HCMC fallback.
 */
export async function getHomeProvince(): Promise<string> {
  const store = await cookies();
  const cookieValue = store.get(HOME_PROVINCE_COOKIE)?.value;
  if (cookieValue) return cookieValue;

  const profileHomeCity = await getProfileHomeCity();
  if (profileHomeCity) return profileHomeCity;
  return HCMC_PROVINCE_NAME;
}

export async function setHomeProvince(province: string): Promise<void> {
  const store = await cookies();
  store.set(HOME_PROVINCE_COOKIE, province, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}
