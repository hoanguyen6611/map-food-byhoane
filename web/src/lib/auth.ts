// Server-side-only auth session helper — same convention as ./api.ts (no
// client bundle exposure, BACKEND_API_URL read directly from process.env).
//
// Deliberately minimal per this module's scope decision (overriding
// docs/build-prompts/09-public-web.md's "no web auth" boundary with the
// smallest possible version): sign-in/out + showing the signed-in email in
// the header, nothing else. No silent access-token refresh, no
// middleware-level route protection — there is no protected page yet for
// either to matter for. The access token going stale after 15 minutes has
// zero functional impact today since no page makes an authenticated API call.
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
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionCookiePayload;
    if (!parsed.email) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

/** Server-only: the raw access token, for routes/handlers that call the backend on the user's behalf. Never expose this to the client. */
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionCookiePayload;
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
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
  const payload: SessionCookiePayload = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    email: body.user.email,
  };

  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
