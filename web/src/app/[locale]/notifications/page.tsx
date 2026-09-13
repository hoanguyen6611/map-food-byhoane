import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { NotificationListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
import { markNotificationReadAction } from './actions';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function NotificationsPage({ params }: PageProps) {
  const { locale } = await params;
  const res = await backendFetchAuthorized('/me/notifications?page=1&pageSize=20');
  if (!res) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/notifications -> ${res.status}`);
  }
  const data = (await res.json()) as NotificationListResponse;

  const [t, tCommon] = await Promise.all([getTranslations('notifications'), getTranslations('common')]);

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {t('title')}
      </h1>

      {data.items.length === 0 ? (
        <p className="empty-state">{t('empty')}</p>
      ) : (
        data.items.map((notification) => (
          <div
            key={notification.id}
            className={`notification-item ${!notification.isRead ? 'notification-item-unread' : ''}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div>{notification.payload.title}</div>
                <p>{notification.payload.body}</p>
                <p style={{ fontSize: 11 }}>
                  {new Date(notification.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}
                </p>
              </div>
              {!notification.isRead ? (
                <form action={markNotificationReadAction.bind(null, notification.id)}>
                  <button type="submit" className="notification-mark-read">
                    {t('markRead')}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))
      )}
      <p style={{ marginTop: 24 }}>
        <Link href="/">{tCommon('home')}</Link>
      </p>
    </div>
  );
}
