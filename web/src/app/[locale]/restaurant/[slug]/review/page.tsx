import type { Metadata } from 'next';
import { redirectToLogin } from '@/lib/require-login';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiNotFoundError, getRestaurantBySlug, getReviewsForRestaurant } from '@/lib/api';
import { formatPriceRange } from '@/lib/format';
import { getSession } from '@/lib/auth';
import { WriteReviewScreen } from '@/components/WriteReviewScreen';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('writeReview');
  return { title: t('heading'), robots: { index: false, follow: false } };
}

/** Dedicated write-review screen (mobile design's "Viết đánh giá"), opened from the detail page's FAB. */
export default async function WriteReviewPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) {
    redirectToLogin(`/restaurant/${slug}/review`);
  }

  let restaurant;
  try {
    restaurant = await getRestaurantBySlug(slug);
  } catch (error) {
    if (error instanceof ApiNotFoundError) notFound();
    throw error;
  }

  const [tCommon, reviews] = await Promise.all([
    getTranslations('common'),
    // Only needed for the criteria list (`ratingBreakdown` is computed even with zero reviews).
    getReviewsForRestaurant(restaurant.id, 1),
  ]);
  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);
  const meta = [restaurant.categoryLabel, restaurant.address.district, priceLabel ? `${priceLabel}đ` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="container review-screen-container">
      <WriteReviewScreen
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        restaurantMeta={meta}
        thumbUrl={restaurant.photos[0]?.url ?? null}
        criteria={reviews.ratingBreakdown.map((c) => ({ code: c.code, label: c.label }))}
      />
    </div>
  );
}
