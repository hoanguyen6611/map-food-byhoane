import type { MetadataRoute } from 'next';
import { listSitemapEntries } from '@/lib/api';
import { DISTRICTS } from '@/lib/districts';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3001';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await listSitemapEntries();

  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/tim-kiem`, changeFrequency: 'daily', priority: 0.8 },
    ...DISTRICTS.map((district) => ({
      url: `${SITE_URL}/khu-vuc/${district.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
    ...entries.map((entry) => ({
      url: `${SITE_URL}/quan/${entry.slug}`,
      lastModified: entry.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
