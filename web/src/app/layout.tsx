import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3001';
const SITE_NAME = 'The Food Map of Vietnam';
const SITE_DESCRIPTION =
  'Bản đồ ẩm thực Việt Nam — tìm quán ăn, quán cà phê, nhà hàng phù hợp nhất với bạn, không chỉ gần bạn nhất.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'vi_VN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e4572e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <a href="#main-content" className="skip-link">
          Bỏ qua để đến nội dung chính
        </a>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo" aria-label={`${SITE_NAME} — về trang chủ`}>
              🍜 {SITE_NAME}
            </Link>
            <nav aria-label="Điều hướng chính">
              <Link href="/tim-kiem">Tìm quán ăn</Link>
            </nav>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>
              © {new Date().getFullYear()} {SITE_NAME}
            </span>
            <span>
              Muốn viết đánh giá hoặc lưu quán yêu thích? Dùng ứng dụng di động The Food Map of
              Vietnam.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
