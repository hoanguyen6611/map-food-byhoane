import Link from 'next/link';
import type { Metadata } from 'next';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_LABELS } from '@/lib/labels';
import { DISTRICTS } from '@/lib/districts';
import type { RestaurantCategoryCode } from '@foodmap/shared-types';

export const metadata: Metadata = {
  title: undefined, // uses the default from layout.tsx's template
  alternates: { canonical: '/' },
};

const FEATURED_CATEGORIES: RestaurantCategoryCode[] = ['quan_an', 'quan_ca_phe', 'nha_hang', 'quan_bar'];

export default async function HomePage() {
  const featured = await searchRestaurants({ pageSize: 8 });

  return (
    <>
      <section className="hero container">
        <h1>Tìm đúng quán, không chỉ quán gần nhất</h1>
        <p>
          Bản đồ ẩm thực Việt Nam — khám phá quán ăn, quán cà phê, nhà hàng và xe đẩy vỉa hè ở TP.
          Hồ Chí Minh qua đánh giá thật từ cộng đồng.
        </p>
        <form action="/tim-kiem" className="search-form" role="search">
          <input
            type="text"
            name="q"
            placeholder="Tìm theo tên quán, món ăn..."
            aria-label="Từ khoá tìm kiếm"
          />
          <button type="submit">Tìm kiếm</button>
        </form>
      </section>

      <div className="container">
        <h2 className="section-title">Danh mục</h2>
        <div className="chip-row">
          {FEATURED_CATEGORIES.map((code) => (
            <Link key={code} href={`/tim-kiem?category=${code}`} className="chip">
              {CATEGORY_LABELS[code]}
            </Link>
          ))}
        </div>

        <h2 className="section-title">Khu vực</h2>
        <div className="chip-row">
          {DISTRICTS.map((district) => (
            <Link key={district.slug} href={`/khu-vuc/${district.slug}`} className="chip">
              {district.name}
            </Link>
          ))}
        </div>

        <h2 className="section-title">Quán nổi bật</h2>
        {featured.items.length === 0 ? (
          <p className="empty-state">Chưa có quán nào được đăng.</p>
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
