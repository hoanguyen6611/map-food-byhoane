'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="empty-state" role="alert">
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{t('title')}</h1>
        <p style={{ marginBottom: 20 }}>{t('body')}</p>
        <button type="button" className="btn-dark btn-dark-lg" onClick={() => reset()}>
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
