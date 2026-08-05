'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="empty-state" role="alert">
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Đã có lỗi xảy ra</h1>
        <p style={{ marginBottom: 20 }}>
          Không thể tải trang này ngay bây giờ. Vui lòng thử lại sau ít phút.
        </p>
        <button type="button" className="filter-submit" onClick={() => reset()}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
