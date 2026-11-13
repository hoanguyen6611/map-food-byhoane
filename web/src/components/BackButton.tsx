'use client';

import { useRouter } from '@/i18n/navigation';
import { ChevronLeftIcon } from './icons';

interface Props {
  label: string;
  /** Used only if there's no actual browser history to go back to (e.g. this page was opened directly) — router.back() would otherwise leave the site entirely. */
  fallbackHref: string;
}

export function BackButton({ label, fallbackHref }: Props) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="detail-hero-back-btn"
      aria-label={label}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <ChevronLeftIcon size={18} />
    </button>
  );
}
