import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthStatus } from '@/components/AuthStatus';
import { FavoritesProvider } from '@/components/FavoritesProvider';
import '../globals.css';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const SITE_NAME = 'The Food Map of Vietnam';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: t('siteDescription'),
    openGraph: {
      siteName: SITE_NAME,
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'vi_VN',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e4572e',
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enables static rendering for this locale (next-intl requirement when
  // reading the locale from route params rather than a request header).
  setRequestLocale(locale);
  const t = await getTranslations('common');

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <FavoritesProvider>
            <a href="#main-content" className="skip-link">
              {t('skipToContent')}
            </a>
            <header className="site-header">
              <div className="container">
                <Link href="/" className="logo" aria-label={t('homeAriaLabel')}>
                  {/* Chopstick Pin mark ("1c" in the "Food Map Logo Icon" design
                      canvas) — a map pin outline with two crossed chopsticks.
                      Brand-orange stroke (matches the design's own icon+wordmark
                      pairing) while the wordmark itself keeps .logo's neutral
                      text color. */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="#E4572E"
                    strokeLinecap="round"
                    aria-hidden="true"
                    style={{ verticalAlign: -4 }}
                  >
                    <path
                      d="M32 7c-11 0-19.9 8.8-19.9 19.6 0 6.6 4.1 13.1 8.6 18.1 3.6 4 7.4 7.2 9.3 8.7.5.4 1.3.4 1.8 0 1.9-1.5 5.7-4.7 9.3-8.7 4.5-5 8.6-11.5 8.6-18.1C51.9 15.8 43 7 32 7Z"
                      strokeWidth={6}
                    />
                    <path d="M24 33 40.5 20.5" strokeWidth={5.5} />
                    <path d="M24 26 40.5 13.5" strokeWidth={5.5} />
                  </svg>{' '}
                  {SITE_NAME}
                </Link>
                <nav aria-label={t('mainNav')}>
                  <Link href="/search">{t('findRestaurants')}</Link>
                  <AuthStatus />
                  <LanguageSwitcher />
                </nav>
              </div>
            </header>
            <main id="main-content">{children}</main>
            <footer className="site-footer">
              <div className="container">
                <span>
                  © {new Date().getFullYear()} {SITE_NAME}
                </span>
                <span>{t('footerCta')}</span>
              </div>
            </footer>
          </FavoritesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
