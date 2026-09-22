'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { deleteAccountAction } from '@/app/[locale]/profile/actions';
import { useToast } from './ToastProvider';

export function ProfileSettingsTab() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteAccountAction();
    if (result.ok) {
      router.push('/');
      router.refresh();
      return;
    }
    setIsDeleting(false);
    showToast(t('deleteAccountError'), 'error');
  }

  return (
    <div className="info-card">
      <h2 className="info-card-title" style={{ margin: '0 0 4px' }}>
        {t('deleteAccountHeading')}
      </h2>
      <p className="profile-edit-hint">{t('deleteAccountBody')}</p>
      {confirming ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="button" className="secondary-btn" onClick={() => setConfirming(false)} disabled={isDeleting}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="profile-review-action profile-review-action-danger"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t('saving') : t('confirmDelete')}
          </button>
        </div>
      ) : (
        <button type="button" className="secondary-btn" style={{ marginTop: 12 }} onClick={() => setConfirming(true)}>
          {t('deleteAccountCta')}
        </button>
      )}
    </div>
  );
}
