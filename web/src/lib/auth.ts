// Server-side-only auth session helper — same convention as ./api.ts (no
// client bundle exposure, BACKEND_API_URL read directly from process.env).
//
// Deliberately minimal per this module's scope decision (overriding
// docs/build-prompts/09-public-web.md's "no web auth" boundary with the
// smallest possible version): sign-in/out + showing the signed-in email in
// the header, plus (see `backendFetchAuthorized`) the one silent
// access-token refresh the favorites feature actually needs now that it
// makes authenticated backend calls — no middleware-level route protection,
// there is still no protected *page* for that to matter for.
import { cookies } from 'next/headers';
import type { AuthResponse } from '@foodmap/shared-types';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'fm_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches the backend's refresh-token TTL.

interface SessionCookiePayload {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export interface Session {
  email: string;
}

/** Reads and validates the session cookie. Never throws — malformed/missing cookie just means "signed out". */
export async function getSession(): Promise<Session | null> {
  const parsed = await readSessionCookie();
  return parsed?.email ? { email: parsed.email } : null;
}

async function readSessionCookie(): Promise<SessionCookiePayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionCookiePayload;
  } catch {
    return null;
  }
}

async function writeSessionCookie(payload: SessionCookiePayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Rotates the session's tokens via `POST /auth/refresh` (same backend
 * contract the mobile app's API client uses) and persists the new pair.
 * Returns the new access token, or `null` if the refresh token itself is
 * invalid/expired/revoked — in which case the session is truly over and the
 * cookie is cleared rather than left pointing at dead tokens.
 */
async function refreshSession(): Promise<string | null> {
  const current = await readSessionCookie();
  if (!current) return null;

  const res = await fetch(`${BACKEND_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    return null;
  }

  const body = (await res.json()) as AuthResponse;
  await writeSessionCookie({ accessToken: body.accessToken, refreshToken: body.refreshToken, email: body.user.email });
  return body.accessToken;
}

/**
 * Server-only: calls the backend on the signed-in user's behalf, attaching
 * the current access token. A `401` (the 15-minute access token has gone
 * stale — normal, not an error) triggers exactly one `refreshSession()` +
 * retry, mirroring `mobile/src/api/client.ts`'s single-retry pattern, so a
 * long-lived browser tab doesn't silently start dropping favorites the
 * moment the access token expires. Returns `null` if there's no session at
 * all, or if the retried request still 401s (refresh token also dead —
 * caller should treat this exactly like "signed out").
 */
export async function backendFetchAuthorized(path: string, init: RequestInit = {}): Promise<Response | null> {
  const session = await readSessionCookie();
  if (!session) return null;

  const attempt = (token: string) =>
    fetch(`${BACKEND_API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

  let res = await attempt(session.accessToken);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return res;
    res = await attempt(refreshedToken);
  }
  return res;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Calls the backend directly (server-to-server — never from browser JS, so this never touches CORS). */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BACKEND_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    // Same generic message regardless of cause (no such account vs. wrong
    // password) — mirrors the mobile app's LoginScreen convention, no user
    // enumeration.
    return { ok: false, error: 'Email hoặc mật khẩu không đúng.' };
  }

  const body = (await res.json()) as AuthResponse;
  await writeSessionCookie({ accessToken: body.accessToken, refreshToken: body.refreshToken, email: body.user.email });
  return { ok: true };
}

/** Calls the backend directly (server-to-server, same as `login`). Mirrors `POST /auth/register`'s real contract — the design's sign-up tab is wired to this, not decorative. */
export async function register(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BACKEND_API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    // 409 = email already registered; anything else is a generic failure.
    return {
      ok: false,
      error: res.status === 409 ? 'Email này đã được đăng ký.' : 'Không thể tạo tài khoản. Vui lòng thử lại.',
    };
  }

  const body = (await res.json()) as AuthResponse;
  await writeSessionCookie({ accessToken: body.accessToken, refreshToken: body.refreshToken, email: body.user.email });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
