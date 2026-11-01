import type { MetadataRoute } from 'next';
import { listSitemapEntries } from '@/lib/api';
import { DISTRICTS } from '@/lib/districts';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';

// Builds one sitemap entry per URL with hreflang alternates pointing at
// every locale's version of that same page (Vietnamese unprefixed, English
// under `/en`, per routing.ts's `localePrefix: 'as-needed'`).
function entry(href: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${getPathname({ href, locale: routing.defaultLocale })}`,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${SITE_URL}${getPathname({ href, locale })}`]),
      ),
    },
    ...extra,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // This route is statically generated at build time, which means a single
  // backend hiccup at the exact moment Vercel/CI builds would otherwise fail
  // the ENTIRE site build (sitemap.xml has no partial-success mode). The
  // static/district entries below don't depend on the backend at all, so
  // it's strictly better to ship a sitemap briefly missing restaurant pages
  // than to fail the whole deploy over a transient 502 — ISR re-runs this on
  // the next revalidation window regardless.
  let entries: Awaited<ReturnType<typeof listSitemapEntries>> = [];
  try {
    entries = await listSitemapEntries();
  } catch (err) {
    console.error('[sitemap] listSitemapEntries failed, shipping sitemap without restaurant entries:', err);
  }

  return [
    entry('/', { changeFrequency: 'weekly', priority: 1 }),
    entry('/search', { changeFrequency: 'daily', priority: 0.8 }),
    ...DISTRICTS.map((district) => entry(`/district/${district.slug}`, { changeFrequency: 'daily', priority: 0.75 })),
    ...entries.map((e) =>
      entry(`/restaurant/${e.slug}`, { lastModified: e.updatedAt, changeFrequency: 'weekly', priority: 0.7 }),
    ),
  ];
}
