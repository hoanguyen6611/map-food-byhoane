'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { loginAction } from './actions';

interface FormState {
  error: boolean;
}

/**
 * Client component so a successful login can force a real page reload
 * (`window.location.href`) instead of relying on the App Router's soft
 * client-side navigation — see actions.ts's doc comment for why that
 * matters here.
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();

  async function submit(_prevState: FormState, formData: FormData): Promise<FormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const result = await loginAction(email, password);
    if (result.ok) {
      window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
      return { error: false };
    }
    return { error: true };
  }

  const [state, formAction, isPending] = useActionState(submit, { error: false });

  return (
    <form action={formAction} className="login-form">
      {state.error ? (
        <p className="login-error" role="alert">
          {t('genericError')}
        </p>
      ) : null}
      <label className="login-field">
        <span>{t('email')}</span>
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label className="login-field">
        <span>{t('password')}</span>
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <button type="submit" className="login-submit" disabled={isPending}>
        {t('signIn')}
      </button>
    </form>
  );
}
