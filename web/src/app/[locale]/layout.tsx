import type { Metadata, Viewport } from 'next';
import { Archivo, Figtree, Inter_Tight } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { routing } from '@/i18n/routing';
import { FavoritesProvider } from '@/components/FavoritesProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { SiteTopBar } from '@/components/SiteTopBar';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE_NAME } from '@/lib/constants';
import '../globals.css';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';

// next/font/google self-hosts at build time (fetches once, serves from this
// app's own domain) — satisfies the redesign's "self-host in production"
// note without a checked-in variable-TTF file. CSS variables are consumed by
// globals.css (`--font-archivo`/`--font-inter-tight`/`--font-figtree`).
const archivo = Archivo({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-archivo' });
const interTight = Inter_Tight({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['500', '600', '700'], variable: '--font-inter-tight' });
// Figtree has no dedicated "vietnamese" subset upstream — "latin-ext" already covers Vietnamese diacritics for this font.
const figtree = Figtree({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-figtree' });

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#003cff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f13' },
  ],
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
    // suppressHydrationWarning on <html> is next-themes' own documented
    // requirement — it sets `data-theme` via an inline script before
    // hydration (so there's no flash of the wrong theme), which makes the
    // server-rendered and first-client-rendered attribute legitimately
    // differ; this tells React that one specific, expected mismatch is fine
    // without suppressing real ones anywhere else.
    <html lang={locale} className={`${archivo.variable} ${interTight.variable} ${figtree.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <NextIntlClientProvider>
            <ToastProvider>
              <FavoritesProvider>
                <a href="#main-content" className="skip-link">
                  {t('skipToContent')}
                </a>
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-canvas)' }}>
                  <SiteTopBar />
                  <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {children}
                  </main>
                  <SiteFooter />
                </div>
              </FavoritesProvider>
            </ToastProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
