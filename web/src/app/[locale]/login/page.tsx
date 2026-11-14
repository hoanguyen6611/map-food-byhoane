import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './LoginForm';
import { LockIcon, MapLogoIcon } from '@/components/icons';
import { parseLoginReason, safeNextPath } from '@/lib/login-href';

// Utility page, not a discovery/content page — keep it out of the index per
// this app's overall SEO focus.
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ next?: string; reason?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext, reason: rawReason } = await searchParams;
  const next = safeNextPath(rawNext);
  const reason = parseLoginReason(rawReason);
  const [t, tPrompt] = await Promise.all([getTranslations('auth'), getTranslations('loginPrompt')]);

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

        {reason ? (
          <p className="login-reason" role="status">
            <LockIcon size={16} aria-hidden="true" />
            <span>{tPrompt(`reason.${reason}`)}</span>
          </p>
        ) : null}

        <LoginForm next={next} />

        <p className="login-footnote">{t('footnote')}</p>
      </div>
    </div>
  );
}
