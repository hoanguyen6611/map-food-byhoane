import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_OPTIONS } from '@/lib/labels';
import { DISTRICTS } from '@/lib/districts';
import { Link, getPathname } from '@/i18n/navigation';
import type { RestaurantCategoryCode } from '@foodmap/shared-types';

export const metadata: Metadata = {
  // No `title` key here at all — Next.js only inherits a parent segment's
  // title when the field is omitted entirely. Explicitly setting
  // `title: undefined` (the previous code here) still counts as this
  // segment defining `title`, which blanks it out for the WHOLE app instead
  // of falling back to layout.tsx's default/template — no <title> tag was
  // being rendered at all as a result.
  alternates: { canonical: '/' },
};

const FEATURED_CATEGORIES: RestaurantCategoryCode[] = ['quan_an', 'quan_ca_phe', 'nha_hang', 'quan_bar'];

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const [t, tLabels] = await Promise.all([getTranslations('home'), getTranslations('labels')]);
  const featured = await searchRestaurants({ pageSize: 8 });
  // Plain HTML <form action> can't use next-intl's <Link> — resolve the
  // locale-prefixed path (e.g. `/en/search`) by hand instead.
  const searchActionPath = getPathname({ href: '/search', locale });

  return (
    <>
      <section className="hero container">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroSubtitle')}</p>
        <form action={searchActionPath} className="search-form" role="search">
          <input type="text" name="q" placeholder={t('searchPlaceholder')} aria-label={t('searchAriaLabel')} />
          <button type="submit">{t('searchButton')}</button>
        </form>
      </section>

      <div className="container">
        <h2 className="section-title">{t('categoriesHeading')}</h2>
        <div className="chip-row">
          {FEATURED_CATEGORIES.map((code) => (
            <Link key={code} href={`/search?category=${code}`} className="chip">
              {tLabels(`category.${code}`)}
            </Link>
          ))}
        </div>

        <h2 className="section-title">{t('areasHeading')}</h2>
        <div className="chip-row">
          {DISTRICTS.map((district) => (
            <Link key={district.slug} href={`/district/${district.slug}`} className="chip">
              {district.name}
            </Link>
          ))}
        </div>

        <h2 className="section-title">{t('featuredHeading')}</h2>
        {featured.items.length === 0 ? (
          <p className="empty-state">{t('emptyFeatured')}</p>
        ) : (
          <div className="card-grid">
            {featured.items.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
