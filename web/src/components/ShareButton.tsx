'use client';

import { useTranslations } from 'next-intl';
import { ShareIcon, CheckIcon } from './icons';
import { useState } from 'react';

interface Props {
  title: string;
  /** Icon + visible "Chia sẻ" label (detail page's mobile action row) instead of the default icon-only square. */
  withLabel?: boolean;
  className?: string;
}

/** Native share sheet when available, clipboard-copy fallback otherwise — real functionality, not a decorative dead button. */
export function ShareButton({ title, withLabel, className = 'action-icon-btn' }: Props) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label={withLabel ? undefined : t('share')}
      title={copied ? t('linkCopied') : t('share')}
    >
      {copied ? <CheckIcon size={16} /> : <ShareIcon size={16} />}
      {withLabel ? <span>{copied ? t('linkCopied') : t('share')}</span> : null}
    </button>
  );
}
