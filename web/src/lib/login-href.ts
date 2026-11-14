// Shared (server + client) helpers for "sign in, then come back here".

export type LoginReason =
  | 'required'
  | 'favorite'
  | 'collection'
  | 'helpful'
  | 'reply'
  | 'follow'
  | 'review'
  | 'claim'
  | 'expired';

export const LOGIN_REASONS: readonly LoginReason[] = [
  'required',
  'favorite',
  'collection',
  'helpful',
  'reply',
  'follow',
  'review',
  'claim',
  'expired',
];

/**
 * Only same-site relative paths survive — `//evil.com`, `/\\evil.com`,
 * absolute URLs and the login page itself are rejected, so `?next=` can't
 * become an open redirect or a loop.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/^\/(?:[a-z]{2}\/)?login(?:[/?#]|$)/.test(raw)) return null;
  return raw;
}

export function parseLoginReason(raw: unknown): LoginReason | null {
  return typeof raw === 'string' && (LOGIN_REASONS as readonly string[]).includes(raw) ? (raw as LoginReason) : null;
}

/** `/login?next=…&reason=…` */
export function loginHref(next?: string | null, reason: LoginReason = 'required'): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(next);
  if (safe) params.set('next', safe);
  params.set('reason', reason);
  return `/login?${params.toString()}`;
}
