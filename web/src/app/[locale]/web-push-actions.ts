'use server';

import type { WebPushSubscriptionInput } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';

/** Saves this browser's push subscription for the signed-in user. False = not signed in / backend refused. */
export async function registerWebPushAction(subscription: WebPushSubscriptionInput): Promise<boolean> {
  if (!subscription?.endpoint?.startsWith('https://') || !subscription.keys?.p256dh || !subscription.keys?.auth) return false;
  const res = await backendFetchAuthorized('/me/web-push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      userAgent: subscription.userAgent?.slice(0, 300),
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Stops pushes to this browser for the signed-in user (toggle off, or sign-out). Best-effort. */
export async function removeWebPushAction(endpoint: string): Promise<void> {
  if (!endpoint) return;
  await backendFetchAuthorized('/me/web-push-subscriptions/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => null);
}
