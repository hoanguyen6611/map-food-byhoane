// Persists the Home page's selected province across reloads/visits (per
// the user's explicit request — a URL query param would reset the moment
// they navigate back to "/", a cookie survives that). Server-only (like
// ./auth.ts) — `getHomeProvince` is safe to call from the Home Server
// Component's render; `setHomeProvince` may only run inside a Server Action
// (see app/[locale]/actions.ts), matching Next.js's `cookies().set()` rule.
import { cookies } from 'next/headers';

const HOME_PROVINCE_COOKIE = 'fm_home_province';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Current restaurant data was seeded before the VN_PROVINCES dataset (code
// '79') was adopted app-wide, using this abbreviated literal instead of the
// dataset's official "Thành phố Hồ Chí Minh" — every existing row's
// `Address.province` is this exact string. Every province-scoped fetch on
// the site must default to it (not the dataset's own HCMC entry, which
// correctly but unhelpfully matches zero of today's rows).
export const HCMC_LEGACY_PROVINCE_NAME = 'TP. Hồ Chí Minh';

export async function getHomeProvince(): Promise<string> {
  const store = await cookies();
  return store.get(HOME_PROVINCE_COOKIE)?.value || HCMC_LEGACY_PROVINCE_NAME;
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
