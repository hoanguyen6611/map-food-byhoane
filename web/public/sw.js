/* FoodMap service worker — Web Push only (no offline caching). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Payload shape: backend WebPushService's WebPushMessage
// { title, body, url, notificationId }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Bản Đồ Ẩm Thực';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/api/pwa-icon/192',
      tag: data.notificationId || undefined,
      data: { url: data.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target;
  try {
    target = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin);
  } catch {
    target = new URL('/notifications', self.location.origin);
  }
  // Only ever navigate within this site.
  if (target.origin !== self.location.origin) target = new URL('/notifications', self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) return client.navigate(target.href);
          return undefined;
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
