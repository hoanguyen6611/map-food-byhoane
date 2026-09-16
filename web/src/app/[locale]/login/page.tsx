import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './LoginForm';

// Utility page, not a discovery/content page — keep it out of the index per
// this app's overall SEO focus.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="page-login">
      <div className="login-wrap">
        <div className="login-header">
          <span className="login-logo-tile" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3.5 4 6v14l5-2.5 6 3 5-2.5V4l-5 2.5z" />
              <path d="M9 3.5v14M15 6.5v14" />
            </svg>
          </span>
          <h1 className="login-heading">{t('welcomeTitle')}</h1>
          <p className="login-sub">{t('welcomeSub')}</p>
        </div>

        <LoginForm />

        <p className="login-footnote">{t('footnote')}</p>
      </div>
    </div>
  );
}
