'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { loginAction, registerAction } from './actions';
import { AlertIcon, MailIcon, LockIcon, CheckIcon, GoogleGIcon, AppleIcon } from '@/components/icons';

interface FormState {
  error: string | null;
}

const EMAIL_RE = /.+@.+\..+/;

type Tab = 'signin' | 'signup';

/**
 * Client component so a successful login/sign-up can force a real page
 * reload (`window.location.href`) instead of relying on the App Router's
 * soft client-side navigation — see actions.ts's doc comment for why that
 * matters here.
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const emailInvalid = email.length > 0 && !EMAIL_RE.test(email);
  const emailValid = EMAIL_RE.test(email);
  const canSubmit = emailValid && password.length >= 6 && (tab === 'signin' || agreed);

  const pwStrength = password.length === 0 ? null : password.length < 6 ? 'weak' : password.length < 10 ? 'medium' : 'strong';
  const pwWidth = pwStrength === 'weak' ? '33%' : pwStrength === 'medium' ? '66%' : pwStrength === 'strong' ? '100%' : '0%';
  const pwColor =
    pwStrength === 'weak'
      ? 'var(--color-error)'
      : pwStrength === 'medium'
        ? 'var(--color-star)'
        : pwStrength === 'strong'
          ? 'var(--color-open-dot)'
          : 'transparent';

  async function submit(_prev: FormState): Promise<FormState> {
    if (!canSubmit) return { error: t('genericError') };
    const result = tab === 'signin' ? await loginAction(email, password) : await registerAction(email, password);
    if (result.ok) {
      window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
      return { error: null };
    }
    return { error: result.error };
  }

  const [state, formAction, isPending] = useActionState(submit, { error: null });

  return (
    <div className="login-card">
      <div className="login-tabs">
        <button type="button" className={`login-tab-btn ${tab === 'signin' ? 'login-tab-btn-active' : ''}`} onClick={() => setTab('signin')}>
          {t('signIn')}
        </button>
        <button type="button" className={`login-tab-btn ${tab === 'signup' ? 'login-tab-btn-active' : ''}`} onClick={() => setTab('signup')}>
          {t('createAccount')}
        </button>
      </div>

      <form action={formAction} className="login-form">
        {state.error ? (
          <p className="login-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="login-field">
          <span>{t('email')}</span>
          <div className={`login-input-wrap ${emailInvalid ? 'login-input-wrap-error' : ''}`}>
            <MailIcon size={17} style={{ color: 'var(--color-ink-subtle)' }} />
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.com"
              required
              autoComplete="email"
            />
          </div>
          {emailInvalid ? (
            <span className="login-field-error">
              <AlertIcon size={13} />
              {t('emailInvalid')}
            </span>
          ) : null}
        </div>

        <div className="login-field">
          <div className="login-field-row">
            <span>{t('password')}</span>
            {tab === 'signin' ? (
              <a href="#" className="login-field-link">
                {t('forgotPassword')}
              </a>
            ) : null}
          </div>
          <div className="login-input-wrap">
            <LockIcon size={17} style={{ color: 'var(--color-ink-subtle)' }} />
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>
          {tab === 'signup' && pwStrength ? (
            <div className="pw-strength-row">
              <span className="pw-strength-track">
                <span className="pw-strength-fill" style={{ width: pwWidth, background: pwColor }} />
              </span>
              <span className="pw-strength-label">{t(`pwStrength.${pwStrength}`)}</span>
            </div>
          ) : null}
        </div>

        {tab === 'signup' ? (
          <button type="button" className="login-checkbox-row" onClick={() => setAgreed((a) => !a)}>
            <span className={`login-checkbox ${agreed ? 'login-checkbox-checked' : ''}`}>
              {agreed ? <CheckIcon size={12} style={{ color: '#fff' }} /> : null}
            </span>
            <span className="login-checkbox-text">{t('agreeText')}</span>
          </button>
        ) : null}

        <button
          type="submit"
          className={`login-submit ${canSubmit ? 'login-submit-enabled' : 'login-submit-disabled'}`}
          disabled={isPending || !canSubmit}
        >
          {isPending ? t('submitting') : t('continue')}
        </button>

        <div className="login-divider-row">
          <span className="login-divider-line" />
          <span className="login-divider-text">{t('or')}</span>
          <span className="login-divider-line" />
        </div>

        <div className="login-social-row">
          <button type="button" className="login-social-btn" disabled>
            <GoogleGIcon size={16} />
            Google
          </button>
          <button type="button" className="login-social-btn" disabled>
            <AppleIcon size={16} />
            Apple
          </button>
        </div>
      </form>
    </div>
  );
}
