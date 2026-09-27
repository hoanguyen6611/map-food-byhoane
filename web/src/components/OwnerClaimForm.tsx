'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitOwnerClaimAction } from '@/app/[locale]/restaurant/[slug]/actions';

interface Props {
  restaurantId: string;
  isLoggedIn: boolean;
}

type Phase = 'closed' | 'open' | 'submitting' | 'success' | 'error';

export function OwnerClaimForm({ restaurantId, isLoggedIn }: Props) {
  const t = useTranslations('restaurant');
  const [phase, setPhase] = useState<Phase>('closed');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (phase === 'success') {
    return (
      <div className="info-card owner-claim-card">
        <h2 className="info-card-title">{t('ownerClaimQuestion')}</h2>
        <p className="owner-claim-success">{t('ownerClaimSuccess')}</p>
      </div>
    );
  }

  if (phase === 'closed') {
    return (
      <div className="info-card owner-claim-card">
        <h2 className="info-card-title">{t('ownerClaimQuestion')}</h2>
        <p>{t('ownerClaimBody')}</p>
        {isLoggedIn ? (
          <button type="button" className="secondary-btn" onClick={() => setPhase('open')}>
            {t('ownerClaimButton')}
          </button>
        ) : (
          <a href="/login" className="secondary-btn">
            {t('ownerClaimLoginPrompt')}
          </a>
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase('submitting');
    setErrorMessage(null);
    const result = await submitOwnerClaimAction(restaurantId, { contactPhone, note });
    if (result.ok) {
      setPhase('success');
      return;
    }
    setPhase('error');
    setErrorMessage(result.error === 'conflict' ? t('ownerClaimConflict') : t('ownerClaimError'));
  }

  return (
    <div className="info-card owner-claim-card">
      <h2 className="info-card-title">{t('ownerClaimQuestion')}</h2>
      <form onSubmit={handleSubmit} className="owner-claim-form">
        <label className="write-review-field">
          <span>{t('ownerClaimPhoneLabel')}</span>
          <input
            type="tel"
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </label>
        <label className="write-review-field">
          <span>{t('ownerClaimNoteLabel')}</span>
          <textarea
            required
            minLength={10}
            rows={3}
            placeholder={t('ownerClaimNotePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {errorMessage && (
          <p className="write-review-error" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="owner-claim-form-actions">
          <button type="submit" className="write-review-submit" disabled={phase === 'submitting'}>
            {phase === 'submitting' ? '…' : t('ownerClaimSubmit')}
          </button>
          <button type="button" className="secondary-btn" onClick={() => setPhase('closed')}>
            {t('ownerClaimCancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
