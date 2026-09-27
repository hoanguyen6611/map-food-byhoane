// Parses a pasted Google Maps link into {lat, lng} — same extraction rules
// as web/src/lib/google-maps-link.ts (kept in sync by hand; web's copy
// stays as-is since it already works there, this is for admin-web's owner
// edit form, which has no Next.js server layer of its own to run this in).

// Tried in priority order: the `!3d<lat>!4d<lng>` pair embedded in a
// `/maps/place/...` URL's `data=` param is the actual place-marker pin —
// more precise than `@lat,lng`, which is just wherever the viewport was
// centered when the link was generated (can drift if the sharer panned
// first). `q=`/`ll=` cover the older/plain link formats.
const COORD_PATTERNS = [
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
];

export interface LatLng {
  lat: number;
  lng: number;
}

export function extractLatLngFromUrl(url: string): LatLng | null {
  for (const pattern of COORD_PATTERNS) {
    const match = url.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

// Exact allowlist, not a pattern — this is an SSRF guard (the server fetches
// whatever hostname passes this check), and "google.com.vn" (a real ccTLD
// variant) and "google.evil.com" (attacker-registered) have the exact same
// label shape (`google`.label.label), so no regex can tell them apart. Only
// an explicit list of real Google hostnames is actually safe here.
const ALLOWED_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.vn',
  'www.google.com.vn',
  'maps.google.com.vn',
  'goo.gl',
  'maps.app.goo.gl',
]);

export function isGoogleMapsHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}

export function isShortGoogleMapsLink(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'goo.gl' || h === 'maps.app.goo.gl';
}

/**
 * Resolves a pasted Google Maps link to {lat, lng}, following short-link
 * (goo.gl/maps.app.goo.gl) redirects server-side first — the redirect
 * target is where the real coordinates actually live for those links.
 */
export async function resolveGoogleMapsLink(rawUrl: string): Promise<LatLng | null> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (!isGoogleMapsHost(url.hostname)) {
    return null;
  }

  let finalUrl = url.toString();
  if (isShortGoogleMapsLink(url.hostname)) {
    try {
      const res = await fetch(url.toString(), { redirect: 'follow' });
      finalUrl = res.url;
    } catch {
      return null;
    }
    // The redirect target should still be a Google domain — belt-and-braces
    // against a compromised/unexpected redirect before we regex the result.
    try {
      if (!isGoogleMapsHost(new URL(finalUrl).hostname)) return null;
    } catch {
      return null;
    }
  }

  return extractLatLngFromUrl(finalUrl);
}
