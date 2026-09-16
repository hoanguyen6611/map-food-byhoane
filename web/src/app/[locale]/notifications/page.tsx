import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { NotificationListResponse, NotificationType } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
import { AlertIcon, CheckIcon, CameraIcon } from '@/components/icons';
import { markNotificationReadAction } from './actions';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const NOTIFICATION_ICON: Record<NotificationType, React.ReactNode> = {
  moderation_result: <AlertIcon size={17} />,
  report_resolved: <CheckIcon size={17} />,
  contribution_status: <CameraIcon size={17} />,
};

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
    <div className="container page-sections">
      <div className="page-header">
        <h1 className="section-title" style={{ margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      {data.items.length === 0 ? (
        <p className="empty-state">{t('empty')}</p>
      ) : (
        <div className="section-block-tight" style={{ marginTop: 0 }}>
          {data.items.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${!notification.isRead ? 'notification-item-unread' : ''}`}
            >
              <span className={`notification-icon notification-icon-${notification.type}`} aria-hidden="true">
                {NOTIFICATION_ICON[notification.type]}
              </span>
              <div className="notification-body">
                <span className="notification-title">{notification.payload.title}</span>
                <p className="notification-text">{notification.payload.body}</p>
                <span className="notification-time">
                  {new Date(notification.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}
                </span>
              </div>
              {!notification.isRead ? (
                <form action={markNotificationReadAction.bind(null, notification.id)}>
                  <button type="submit" className="notification-mark-read">
                    {t('markRead')}
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p style={{ marginTop: 20 }}>
        <Link href="/">{tCommon('home')}</Link>
      </p>
    </div>
  );
}
