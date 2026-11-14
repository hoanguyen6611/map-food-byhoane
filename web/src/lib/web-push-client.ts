// Browser-only Web Push helpers (call from client components / effects).
import type { WebPushSubscriptionInput } from '@foodmap/shared-types';
import { registerWebPushAction, removeWebPushAction } from '@/app/[locale]/web-push-actions';

export type PushSupport = 'unsupported' | 'needs-install' | 'supported';

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS/iPadOS (16.4+) only exposes Web Push to a site added to the Home
 * Screen and opened from there — in a normal Safari tab PushManager is
 * missing, so we tell the user to install instead of "unsupported".
 */
export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos() && !isStandalone()) return 'needs-install';
  return hasApis ? 'supported' : 'unsupported';
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toInput(sub: PushSubscription): WebPushSubscriptionInput | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: navigator.userAgent };
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== 'supported') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type EnableResult = 'enabled' | 'denied' | 'error';

/**
 * Must be called straight from a tap: Safari only shows the permission
 * prompt inside a user gesture, so requestPermission() runs before any
 * other await.
 */
export async function enableWebPush(publicKey: string): Promise<EnableResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await getRegistration();
    const key = urlBase64ToUint8Array(publicKey);
    let sub = await reg.pushManager.getSubscription();
    // Subscribed under an older VAPID key (rotated on the server) — replace it.
    const existingKey = sub?.options.applicationServerKey;
    if (sub && existingKey && !sameBytes(new Uint8Array(existingKey), key)) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const input = toInput(sub);
    if (!input) return 'error';
    return (await registerWebPushAction(input)) ? 'enabled' : 'error';
  } catch {
    return 'error';
  }
}

/** Turns push off for this browser (server row + browser subscription). */
export async function disableWebPush(): Promise<void> {
  try {
    const sub = await getExistingSubscription();
    if (!sub) return;
    await removeWebPushAction(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // Best-effort.
  }
}

/**
 * Sign-out: detach this browser from the account on the server but keep the
 * browser subscription + permission, so signing back in (WebPushSync)
 * resumes pushes without asking again — same as the app re-registering its
 * token on login.
 */
export async function detachWebPushForSignOut(): Promise<void> {
  try {
    const sub = await getExistingSubscription();
    if (sub) await removeWebPushAction(sub.endpoint);
  } catch {
    // Best-effort — never block sign-out.
  }
}

/** Re-sends an existing subscription (account switch, row cleaned server-side). */
export async function syncWebPush(): Promise<void> {
  try {
    if (Notification.permission !== 'granted') return;
    const sub = await getExistingSubscription();
    const input = sub ? toInput(sub) : null;
    if (input) await registerWebPushAction(input);
  } catch {
    // Best-effort.
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
