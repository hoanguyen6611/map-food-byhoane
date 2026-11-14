'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CuisineDto, UserProfileDto } from '@foodmap/shared-types';
import { routing } from '@/i18n/routing';
import { logoutAction } from '@/app/[locale]/login/actions';
import { EditProfileModal } from './EditProfileModal';
import { ShareButton } from './ShareButton';
import { ConfirmBottomSheet } from './ConfirmBottomSheet';
import { LogOutIcon, PencilIcon } from './icons';

interface Props {
  profile: UserProfileDto;
  cuisineOptions: CuisineDto[];
  shareTitle: string;
}

export function ProfileHeaderActions({ profile, cuisineOptions, shareTitle }: Props) {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Real reload (not router navigation) — same reasoning as TopBarNav's
  // own handleLogout: a Server Action's effect on a soft client-side nav
  // doesn't remount it, so it'd keep showing "signed in". Sign-out used to
  // only live in the header's hamburger overlay/account dropdown — with
  // the bottom tab bar now making this Profile page the primary way to
  // reach "account" on mobile, it needs a copy right here too, visible the
  // moment the page opens rather than buried inside the Settings card
  // below (which also still has its own copy — this isn't a replacement).
  // Opens a confirm sheet first (matches the redesign's `openLogout`/
  // `logoutOpen`) instead of signing out on the first tap.
  async function handleLogout() {
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  return (
    <div className="profile-header-actions">
      <button type="button" className="btn-dark" onClick={() => setEditing(true)}>
        <PencilIcon size={16} aria-hidden="true" />
        <span className="btn-dark-label">{t('editHeading')}</span>
      </button>
      <ShareButton title={shareTitle} />
      <button type="button" className="action-icon-btn" onClick={() => setLoggingOut(true)} aria-label={tAuth('signOut')} title={tAuth('signOut')}>
        <LogOutIcon size={16} />
      </button>
      {editing ? <EditProfileModal profile={profile} cuisineOptions={cuisineOptions} onClose={() => setEditing(false)} /> : null}
      <ConfirmBottomSheet
        open={loggingOut}
        onClose={() => setLoggingOut(false)}
        icon={<LogOutIcon size={24} />}
        danger
        title={t('logoutConfirmTitle')}
        body={t('logoutConfirmBody')}
        cancelLabel={t('cancel')}
        confirmLabel={tAuth('signOut')}
        onConfirm={handleLogout}
      />
    </div>
  );
}
