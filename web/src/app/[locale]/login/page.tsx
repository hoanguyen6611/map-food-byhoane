import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './LoginForm';
import { MapLogoIcon } from '@/components/icons';

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
            <MapLogoIcon size={24} style={{ color: '#fff' }} />
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
