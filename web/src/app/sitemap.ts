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
  const entries = await listSitemapEntries();

  return [
    entry('/', { changeFrequency: 'weekly', priority: 1 }),
    entry('/search', { changeFrequency: 'daily', priority: 0.8 }),
    ...DISTRICTS.map((district) => entry(`/district/${district.slug}`, { changeFrequency: 'daily', priority: 0.75 })),
    ...entries.map((e) =>
      entry(`/restaurant/${e.slug}`, { lastModified: e.updatedAt, changeFrequency: 'weekly', priority: 0.7 }),
    ),
  ];
}
