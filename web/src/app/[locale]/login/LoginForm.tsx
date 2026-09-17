'use client';

import { useActionState, useRef, useState } from 'react';
import Script from 'next/script';
import { useLocale, useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { loginAction, registerAction, oauthLoginAction } from './actions';
import { AlertIcon, MailIcon, LockIcon, CheckIcon, GoogleGIcon, AppleIcon } from '@/components/icons';

interface FormState {
  error: string | null;
}

const EMAIL_RE = /.+@.+\..+/;

type Tab = 'signin' | 'signup';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID;
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (parent: HTMLElement, options: { type: 'standard' | 'icon' }) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

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
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<'google' | 'apple' | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  function goToApp() {
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  async function handleOAuthToken(provider: 'google' | 'apple', idToken: string) {
    setOauthPending(provider);
    const result = await oauthLoginAction(provider, idToken);
    setOauthPending(null);
    if (result.ok) {
      goToApp();
      return;
    }
    setOauthError(result.error);
  }

  function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID || !window.google) {
      setOauthError(t('socialLoginError'));
      return;
    }
    setOauthError(null);
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => void handleOAuthToken('google', response.credential),
    });
    // Custom-styled button that triggers Google's real consent popup: GSI's
    // own rendered button (into a hidden container below) is what actually
    // owns the click-to-open-popup behavior, so this button forwards the
    // click to it rather than trying to open the popup itself.
    if (googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, { type: 'standard' });
      (googleButtonRef.current.querySelector('div[role="button"]') as HTMLElement | null)?.click();
    }
  }

  async function handleAppleClick() {
    if (!APPLE_CLIENT_ID || !APPLE_REDIRECT_URI || !window.AppleID) {
      setOauthError(t('socialLoginError'));
      return;
    }
    setOauthError(null);
    try {
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'email',
        redirectURI: APPLE_REDIRECT_URI,
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      await handleOAuthToken('apple', response.authorization.id_token);
    } catch {
      setOauthError(t('socialLoginError'));
    }
  }

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
      goToApp();
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

        {oauthError ? (
          <p className="login-error" role="alert">
            {oauthError}
          </p>
        ) : null}

        <div className="login-social-row">
          <button type="button" className="login-social-btn" onClick={handleGoogleClick} disabled={oauthPending !== null}>
            <GoogleGIcon size={16} />
            {oauthPending === 'google' ? t('submitting') : t('continueWithGoogle')}
          </button>
          <button type="button" className="login-social-btn" onClick={() => void handleAppleClick()} disabled={oauthPending !== null}>
            <AppleIcon size={16} />
            {oauthPending === 'apple' ? t('submitting') : t('continueWithApple')}
          </button>
        </div>
        {/* GSI's own rendered button actually owns the popup-opening click
            handler — kept off-screen (not `display:none`, which some
            browsers refuse to let receive a synthetic click) so the app's
            custom-styled button above can forward a real click to it. */}
        <div ref={googleButtonRef} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} />
      </form>

      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <Script src="https://appleid.cdn-apple.com/appleauth/auth/appleid.auth.js" strategy="afterInteractive" />
    </div>
  );
}
