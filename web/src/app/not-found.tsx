import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container empty-state" style={{ paddingTop: 64 }}>
      <h1>Không tìm thấy trang</h1>
      <p>Quán ăn hoặc trang bạn tìm không tồn tại, hoặc đã ngừng hoạt động.</p>
      <Link href="/">Về trang chủ</Link>
    </div>
  );
}
