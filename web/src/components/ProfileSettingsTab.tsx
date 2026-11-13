'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { deleteAccountAction } from '@/app/[locale]/profile/actions';
import { logoutAction } from '@/app/[locale]/login/actions';
import { useToast } from './ToastProvider';

export function ProfileSettingsTab() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Real reload (not router navigation) — same reasoning as AuthStatus's/
  // TopBarNav's own handleLogout: a Server Action's effect on a soft
  // client-side nav doesn't remount either of those, so they'd keep
  // showing "signed in". Sign-out itself used to only live in the
  // header's account menu/hamburger overlay — now that the bottom tab bar
  // makes this Settings tab the primary way to reach "account" on mobile,
  // it needs its own copy here too.
  async function handleLogout() {
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

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
    <>
      <div className="info-card" style={{ marginBottom: 14 }}>
        <h2 className="info-card-title" style={{ margin: '0 0 4px' }}>
          {tAuth('signOut')}
        </h2>
        <button type="button" className="secondary-btn" style={{ marginTop: 12 }} onClick={handleLogout}>
          {tAuth('signOut')}
        </button>
      </div>

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
    </>
  );
}
