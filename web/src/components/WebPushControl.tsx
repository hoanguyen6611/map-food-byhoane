'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from './ToastProvider';
import { BellIcon, CloseIcon } from './icons';
import {
  disableWebPush,
  enableWebPush,
  getExistingSubscription,
  getPushSupport,
  type PushSupport,
} from '@/lib/web-push-client';

interface Props {
  /** VAPID key from GET /push/web/config; null = backend has web push off → render nothing. */
  publicKey: string | null;
  /** `row`: switch inside Profile → Settings. `card`: prompt on the Notifications page (hidden once on/dismissed). */
  variant: 'row' | 'card';
}

type State =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'needs-install' }
  | { kind: 'denied' }
  | { kind: 'ready'; enabled: boolean };

const CARD_DISMISS_KEY = 'fm_push_card_dismissed';

async function detect(support: PushSupport): Promise<State> {
  if (support === 'unsupported') return { kind: 'unsupported' };
  if (support === 'needs-install') return { kind: 'needs-install' };
  if (Notification.permission === 'denied') return { kind: 'denied' };
  const sub = Notification.permission === 'granted' ? await getExistingSubscription() : null;
  return { kind: 'ready', enabled: Boolean(sub) };
}

export function WebPushControl({ publicKey, variant }: Props) {
  const t = useTranslations('push');
  const { showToast } = useToast();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void detect(getPushSupport()).then((s) => !cancelled && setState(s));
    try {
      setDismissed(localStorage.getItem(CARD_DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!publicKey || state.kind === 'loading') return null;

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    const result = await enableWebPush(publicKey);
    setBusy(false);
    if (result === 'enabled') {
      setState({ kind: 'ready', enabled: true });
      showToast(t('enabledToast'));
    } else if (result === 'denied') {
      setState(Notification.permission === 'denied' ? { kind: 'denied' } : { kind: 'ready', enabled: false });
      showToast(t('deniedHint'), 'error');
    } else {
      showToast(t('errorToast'), 'error');
    }
  }

  async function turnOff() {
    setBusy(true);
    await disableWebPush();
    setBusy(false);
    setState({ kind: 'ready', enabled: false });
    showToast(t('disabledToast'));
  }

  const hint =
    state.kind === 'needs-install'
      ? t('installHint')
      : state.kind === 'denied'
        ? t('deniedHint')
        : state.kind === 'unsupported'
          ? t('unsupportedHint')
          : null;

  if (variant === 'card') {
    // Only nudges people who could still turn it on.
    if (dismissed || state.kind === 'unsupported' || (state.kind === 'ready' && state.enabled)) return null;
    return (
      <div className="push-card" role="region" aria-label={t('cardTitle')}>
        <span className="push-card-icon" aria-hidden="true">
          <BellIcon size={18} />
        </span>
        <div className="push-card-body">
          <p className="push-card-title">{t('cardTitle')}</p>
          <p className="push-card-text">{hint ?? t('cardBody')}</p>
          {state.kind === 'ready' ? (
            <button type="button" className="push-card-btn" onClick={turnOn} disabled={busy}>
              {busy ? t('enabling') : t('enable')}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="push-card-close"
          aria-label={t('dismiss')}
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(CARD_DISMISS_KEY, '1');
            } catch {
              // Per-visitor convenience only.
            }
          }}
        >
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  const enabled = state.kind === 'ready' && state.enabled;
  return (
    <div className="profile-settings-lang-row profile-settings-push-row">
      <BellIcon size={18} aria-hidden="true" />
      <span className="profile-settings-lang-label">
        {t('label')}
        {hint ? <span className="profile-settings-push-hint">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('label')}
        disabled={busy || state.kind !== 'ready'}
        className={`toggle-switch ${enabled ? 'toggle-switch-on' : 'toggle-switch-off'}`}
        onClick={enabled ? turnOff : turnOn}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}
