'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { logoutAction } from '@/app/[locale]/login/actions';

interface Session {
  email: string;
}

/**
 * Client-fetched (not server-read) on purpose — see `api/session/route.ts`'s
 * doc comment: reading the session cookie directly in the root layout would
 * force every page on this SEO-focused, mostly-static site to render
 * dynamically. This trades a tiny client-side flash (briefly shows "Sign
 * in") for keeping home/search/restaurant-detail statically generated.
 */
export function AuthStatus() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/session')
      .then((res) => res.json())
      .then((data: Session | null) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A real reload (not router navigation) — same reasoning as LoginForm's
  // doc comment: a Server Action's effect on a soft client-side nav doesn't
  // remount this component, so it would keep showing "signed in" after logout.
  async function handleLogout() {
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  if (session === undefined) {
    // Still resolving — render nothing rather than a flash of "sign in".
    return null;
  }

  if (!session) {
    return <Link href="/login">{t('title')}</Link>;
  }

  return (
    <span className="auth-status">
      <Link href="/favorites">{t('favoritesLink')}</Link>
      {t('greeting', { email: session.email })}
      <button type="button" className="auth-signout-button" onClick={handleLogout}>
        {t('signOut')}
      </button>
    </span>
  );
}
