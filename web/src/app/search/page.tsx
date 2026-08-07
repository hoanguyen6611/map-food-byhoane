import Link from 'next/link';
import type { Metadata } from 'next';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { SearchFilterForm } from '@/components/SearchFilterForm';

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function buildTitle(q?: string, category?: string, district?: string): string {
  if (q) return `Kết quả cho "${q}"`;
  if (category || district) return `Quán ăn ${district ? `ở ${district}` : ''}`.trim();
  return 'Tìm kiếm quán ăn';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const title = buildTitle(params.q, params.category, params.district);
  return {
    title,
    description: 'Tìm quán ăn, quán cà phê, nhà hàng ở TP. Hồ Chí Minh theo tên, món ăn, khu vực hoặc bộ lọc.',
    robots: { index: !!(params.q || params.category || params.district), follow: true },
  };
}

const PAGE_SIZE = 20;

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;

  const result = await searchRestaurants({
    q: params.q,
    category: params.category,
    district: params.district,
    cuisine: params.cuisine,
    facilities: params.facilities,
    priceMin: params.priceMin ? Number(params.priceMin) : undefined,
    priceMax: params.priceMax ? Number(params.priceMax) : undefined,
    minRating: params.minRating ? Number(params.minRating) : undefined,
    openNow: params.openNow === 'true',
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') usp.set(key, value);
    }
    usp.set('page', String(targetPage));
    return `/search?${usp.toString()}`;
  }

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {buildTitle(params.q, params.category, params.district)} · {result.total} quán
      </h1>

      <SearchFilterForm
        initial={{
          q: params.q,
          category: params.category,
          district: params.district,
          cuisine: params.cuisine,
          facilities: params.facilities,
          priceMin: params.priceMin,
          priceMax: params.priceMax,
          openNow: params.openNow,
        }}
      />

      {result.items.length === 0 ? (
        <div className="empty-state">
          <p>Không tìm thấy quán nào phù hợp.</p>
          <Link href="/search">Xem tất cả quán ăn</Link>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {result.items.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination">
              {page > 1 ? <Link href={pageHref(page - 1)}>← Trước</Link> : null}
              <span>
                Trang {page}/{totalPages}
              </span>
              {page < totalPages ? <Link href={pageHref(page + 1)}>Sau →</Link> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
