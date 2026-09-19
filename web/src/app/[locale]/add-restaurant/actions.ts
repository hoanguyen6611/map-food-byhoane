'use server';

import { backendFetchAuthorized } from '@/lib/auth';
import { extractLatLngFromUrl, isGoogleMapsHost, isShortGoogleMapsLink, type LatLng } from '@/lib/google-maps-link';
import type {
  CreateRestaurantContributionRequest,
  CreateRestaurantContributionResponse,
  DuplicateCandidateDto,
} from '@foodmap/shared-types';

export type ResolveMapLinkResult = { ok: true; location: LatLng } | { ok: false };

/**
 * Turns a pasted Google Maps link into {lat, lng} for the Add Restaurant
 * form's coordinate field. Runs server-side for two reasons: short links
 * (maps.app.goo.gl/goo.gl) only reveal real coordinates after following a
 * redirect, which a browser fetch can't do cross-origin; and even the
 * direct-fetch step itself needs the isGoogleMapsHost allowlist enforced
 * somewhere trusted, not left to the client.
 */
export async function resolveGoogleMapsLinkAction(rawUrl: string): Promise<ResolveMapLinkResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false };
  }
  if (!isGoogleMapsHost(url.hostname)) {
    return { ok: false };
  }

  let finalUrl = url.toString();
  if (isShortGoogleMapsLink(url.hostname)) {
    try {
      const res = await fetch(url.toString(), { redirect: 'follow' });
      finalUrl = res.url;
    } catch {
      return { ok: false };
    }
    // The redirect target should still be a Google domain — belt-and-braces
    // against a compromised/unexpected redirect before we regex the result.
    try {
      if (!isGoogleMapsHost(new URL(finalUrl).hostname)) return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  const location = extractLatLngFromUrl(finalUrl);
  return location ? { ok: true, location } : { ok: false };
}

export type SubmitContributionResult =
  | { ok: true; status: CreateRestaurantContributionResponse['status'] }
  | { ok: false; error: 'duplicate'; candidates: DuplicateCandidateDto[] }
  | { ok: false; error: 'unauthorized' | 'generic'; message?: string };

export async function submitContributionAction(
  input: CreateRestaurantContributionRequest,
): Promise<SubmitContributionResult> {
  const res = await backendFetchAuthorized('/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res) {
    return { ok: false, error: 'unauthorized' };
  }
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { candidates?: DuplicateCandidateDto[] } | null;
    return { ok: false, error: 'duplicate', candidates: body?.candidates ?? [] };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: 'generic', message };
  }
  const result = (await res.json()) as CreateRestaurantContributionResponse;
  return { ok: true, status: result.status };
}
