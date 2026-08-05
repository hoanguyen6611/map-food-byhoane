import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { DISTRICTS, findDistrictBySlug } from '@/lib/districts';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3001';
const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// A fixed, small set of districts — real SSG rather than on-demand ISR,
// same spirit as the detail page's slug lookup but cheaper since there's
// no backend round-trip needed to enumerate them.
export function generateStaticParams(): { slug: string }[] {
  return DISTRICTS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const district = findDistrictBySlug(slug);
  if (!district) {
    return { title: 'Không tìm thấy khu vực' };
  }

  return {
    title: `Quán ăn ở ${district.name}`,
    description: `Danh sách quán ăn, quán cà phê, nhà hàng ở ${district.name} — đánh giá thật từ cộng đồng The Food Map of Vietnam.`,
    alternates: { canonical: `/khu-vuc/${district.slug}` },
    openGraph: { title: `Quán ăn ở ${district.name}`, type: 'website' },
  };
}

export default async function DistrictPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const district = findDistrictBySlug(slug);
  if (!district) {
    notFound();
  }

  const page = Number(pageParam ?? '1') || 1;
  const result = await searchRestaurants({ district: district.name, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: district.name, item: `${SITE_URL}/khu-vuc/${district.slug}` },
    ],
  };

  // ItemList — only the restaurants actually returned on this page, never
  // fabricated beyond what the backend returned.
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: result.items.map((restaurant, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      url: `${SITE_URL}/quan/${restaurant.slug}`,
      name: restaurant.name,
    })),
  };

  function pageHref(targetPage: number): string {
    return `/khu-vuc/${slug}?page=${targetPage}`;
  }

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {result.items.length > 0 && (
        // eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{district.name}</span>
      </nav>

      <h1 className="section-title" style={{ marginTop: 0 }}>
        Quán ăn ở {district.name} · {result.total} quán
      </h1>

      {result.items.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có quán nào được đăng ở {district.name}.</p>
          <Link href="/tim-kiem">Xem tất cả quán ăn</Link>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {result.items.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Phân trang">
              {page > 1 ? <Link href={pageHref(page - 1)}>← Trước</Link> : null}
              <span>
                Trang {page}/{totalPages}
              </span>
              {page < totalPages ? <Link href={pageHref(page + 1)}>Sau →</Link> : null}
            </nav>
          ) : null}

          <p style={{ marginTop: 24 }}>
            <Link href={`/tim-kiem?district=${encodeURIComponent(district.name)}`}>
              Lọc thêm theo món ăn, giá, tiện ích…
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
