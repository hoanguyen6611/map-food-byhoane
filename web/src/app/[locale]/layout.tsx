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
                  🍜 {SITE_NAME}
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
