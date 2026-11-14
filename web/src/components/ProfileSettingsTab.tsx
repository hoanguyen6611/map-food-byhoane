'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { deleteAccountAction } from '@/app/[locale]/profile/actions';
import { logoutAction } from '@/app/[locale]/login/actions';
import { useToast } from './ToastProvider';
import { WebPushControl } from './WebPushControl';
import { detachWebPushForSignOut } from '@/lib/web-push-client';
import { ConfirmBottomSheet } from './ConfirmBottomSheet';
import { GlobeIcon, LogOutIcon, TrashIcon, ChevronRightIcon, SunIcon, MoonIcon } from './icons';

// Same two languages/self-description convention as LanguageSwitcher.tsx's
// header dropdown — kept in sync by hand since there are only two.
const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'en', name: 'English' },
] as const;

export function ProfileSettingsTab({ webPushPublicKey = null }: { webPushPublicKey?: string | null }) {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Same reasoning as ThemeToggle.tsx — `resolvedTheme` depends on the
  // visitor's OS preference/stored choice, which the server render can't
  // know, so this renders a neutral icon until mounted client-side rather
  // than guessing one that might flip a moment later.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  function selectLocale(code: string) {
    if (code !== locale) router.replace(pathname, { locale: code });
  }

  // Real reload (not router navigation) — same reasoning as TopBarNav's own
  // handleLogout: a Server Action's effect on a soft client-side nav
  // doesn't remount it, so it'd keep showing "signed in".
  async function handleLogout() {
    await detachWebPushForSignOut();
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteAccountAction();
    if (result.ok) {
      window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
      return;
    }
    setIsDeleting(false);
    showToast(t('deleteAccountError'), 'error');
  }

  return (
    <>
      <div className="profile-settings-card">
        <div className="profile-settings-lang-row">
          <GlobeIcon size={18} aria-hidden="true" />
          <span className="profile-settings-lang-label">{tCommon('languageMenuHeading')}</span>
          <span className="profile-lang-pill-group">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`profile-lang-pill ${lang.code === locale ? 'profile-lang-pill-active' : ''}`}
                aria-pressed={lang.code === locale}
                onClick={() => selectLocale(lang.code)}
              >
                {lang.name}
              </button>
            ))}
          </span>
        </div>

        <div className="profile-settings-lang-row profile-settings-theme-row">
          {isDark ? <MoonIcon size={18} aria-hidden="true" /> : <SunIcon size={18} aria-hidden="true" />}
          <span className="profile-settings-lang-label">{t('darkModeLabel')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={t('darkModeLabel')}
            className={`toggle-switch ${isDark ? 'toggle-switch-on' : 'toggle-switch-off'}`}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <WebPushControl publicKey={webPushPublicKey} variant="row" />

        <button type="button" className="profile-settings-row" onClick={() => setLoggingOut(true)}>
          <LogOutIcon size={18} aria-hidden="true" />
          <span className="profile-settings-row-label">{tAuth('signOut')}</span>
          <ChevronRightIcon size={15} className="profile-settings-row-chevron" />
        </button>

        <button
          type="button"
          className="profile-settings-row profile-settings-row-danger"
          onClick={() => setDeleting(true)}
        >
          <TrashIcon size={18} aria-hidden="true" />
          <span className="profile-settings-row-label">{t('deleteAccountHeading')}</span>
          <span className="profile-settings-row-danger-hint">{t('deleteAccountIrreversible')}</span>
          <ChevronRightIcon size={15} className="profile-settings-row-chevron" />
        </button>
      </div>

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

      <ConfirmBottomSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        icon={<TrashIcon size={24} />}
        danger
        title={t('deleteAccountHeading')}
        body={t('deleteAccountBody')}
        cancelLabel={t('cancel')}
        confirmLabel={isDeleting ? t('saving') : t('deleteAccountCta')}
        onConfirm={handleDelete}
        confirmDisabled={!deleteAck || isDeleting}
      >
        <label className="confirm-sheet-ack">
          <input type="checkbox" checked={deleteAck} onChange={() => setDeleteAck((v) => !v)} />
          <span>{t('deleteAccountAck')}</span>
        </label>
      </ConfirmBottomSheet>
    </>
  );
}
