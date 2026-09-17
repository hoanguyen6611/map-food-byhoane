'use server';

import { login, logout, oauthLogin, register } from '@/lib/auth';

// No `redirect()` here on purpose (see LoginForm.tsx / AuthStatus.tsx) — a
// Server Action invoked from a hydrated client only ever produces a soft,
// client-side navigation, which does NOT remount the root layout. Since the
// header's signed-in state is a client component that fetches once on
// mount, a soft nav would leave it showing the stale pre-login state
// forever. The caller forces a real `window.location` reload instead.
export type LoginActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(email: string, password: string): Promise<LoginActionResult> {
  const result = await login(email, password);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function registerAction(email: string, password: string): Promise<LoginActionResult> {
  const result = await register(email, password);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function oauthLoginAction(provider: 'google' | 'apple', idToken: string): Promise<LoginActionResult> {
  const result = await oauthLogin(provider, idToken);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function logoutAction(): Promise<void> {
  await logout();
}
