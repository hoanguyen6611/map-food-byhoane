import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './LoginForm';

// Utility page, not a discovery/content page — keep it out of the index per
// this app's overall SEO focus.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="container page-login">
      <h1>{t('title')}</h1>
      <LoginForm />
    </div>
  );
}
