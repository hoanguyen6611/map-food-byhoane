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

// Current restaurant data was seeded before the VN_PROVINCES dataset (code
// '79') was adopted app-wide, using this abbreviated literal instead of the
// dataset's official "Thành phố Hồ Chí Minh" — every existing row's
// `Address.province` is this exact string. Every province-scoped fetch on
// the site must default to it (not the dataset's own HCMC entry, which
// correctly but unhelpfully matches zero of today's rows).
export const HCMC_LEGACY_PROVINCE_NAME = 'TP. Hồ Chí Minh';

// The dataset's own HCMC entry — also excluded from Home's province select
// options (see page.tsx) for the same reason. Used below to translate a
// profile's `homeCity` (which stores a real VN_PROVINCES name) back to the
// legacy string when it happens to be HCMC.
export const HCMC_DATASET_CODE = '79';
const HCMC_DATASET_NAME = VN_PROVINCES.find((p) => p.code === HCMC_DATASET_CODE)?.name;

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
  if (profileHomeCity) {
    return profileHomeCity === HCMC_DATASET_NAME ? HCMC_LEGACY_PROVINCE_NAME : profileHomeCity;
  }
  return HCMC_LEGACY_PROVINCE_NAME;
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
