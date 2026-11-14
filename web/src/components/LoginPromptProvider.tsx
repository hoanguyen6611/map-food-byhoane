'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmBottomSheet } from './ConfirmBottomSheet';
import { LockIcon } from './icons';
import { useSessionInfo } from '@/lib/useSessionInfo';
import { loginHref, type LoginReason } from '@/lib/login-href';

interface LoginPromptValue {
  /** undefined while /api/session is resolving. */
  isLoggedIn: boolean | undefined;
  /** Opens the "Đăng nhập để …" sheet; "Đăng nhập" goes to /login and back to this page. */
  requireLogin: (reason?: LoginReason) => void;
}

const LoginPromptContext = createContext<LoginPromptValue | null>(null);

/**
 * One shared sign-in prompt for every action that needs an account (save,
 * add to collection, helpful, reply, follow, claim…) — instead of failing
 * silently or jumping to /login with no explanation and no way back.
 */
export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('loginPrompt');
  const session = useSessionInfo();
  const [reason, setReason] = useState<LoginReason | null>(null);

  const requireLogin = useCallback((r: LoginReason = 'required') => setReason(r), []);
  const value = useMemo<LoginPromptValue>(
    () => ({ isLoggedIn: session === undefined ? undefined : session !== null, requireLogin }),
    [session, requireLogin],
  );

  function goToLogin() {
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(loginHref(here, reason ?? 'required'));
  }

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <ConfirmBottomSheet
        open={reason !== null}
        onClose={() => setReason(null)}
        icon={<LockIcon size={24} />}
        title={reason === 'expired' ? t('expiredTitle') : t('title')}
        body={t(`reason.${reason ?? 'required'}`)}
        cancelLabel={t('later')}
        confirmLabel={t('signIn')}
        onConfirm={goToLogin}
      />
    </LoginPromptContext.Provider>
  );
}

export function useLoginPrompt(): LoginPromptValue {
  const ctx = useContext(LoginPromptContext);
  if (!ctx) throw new Error('useLoginPrompt must be used within a LoginPromptProvider');
  return ctx;
}
