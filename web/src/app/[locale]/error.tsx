'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AlertIcon } from '@/components/icons';

// A thrown "Backend request failed: ... -> 401" (see e.g. profile/page.tsx)
// almost always means an expired session slipping past backendFetchAuthorized's
// own refresh — "Thử lại" alone would just hit the same 401 again. Detected
// from the error message itself since a plain thrown Error carries no
// structured status code here.
function isLikelySessionExpired(error: Error): boolean {
  return /\b401\b|unauthorized/i.test(error.message);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');
  const router = useRouter();
  const sessionExpired = isLikelySessionExpired(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="empty-state" role="alert">
        <span className="empty-state-icon">
          <AlertIcon size={28} />
        </span>
        <h1 className="empty-state-title">{sessionExpired ? t('sessionExpiredTitle') : t('title')}</h1>
        <p className="empty-state-body">{sessionExpired ? t('sessionExpiredBody') : t('body')}</p>
        {sessionExpired ? (
          <button type="button" className="btn-dark btn-dark-lg" onClick={() => router.push('/login')}>
            {t('signInAgain')}
          </button>
        ) : (
          <button type="button" className="btn-dark btn-dark-lg" onClick={() => reset()}>
            {t('retry')}
          </button>
        )}
      </div>
    </div>
  );
}
