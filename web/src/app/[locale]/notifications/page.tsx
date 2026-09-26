import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { NotificationListResponse, NotificationType } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { formatRelativeDate } from '@/lib/format';
import { getRestaurantSlugsByIds } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { AlertIcon, CheckIcon, MapPinIcon, ThumbsUpIcon, StarIcon, ClockIcon } from '@/components/icons';
import { markAllNotificationsReadAction } from './actions';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}

const NOTIFICATION_ICON: Record<NotificationType, React.ReactNode> = {
  // Review-decision notifications only (see admin-moderation.service.ts:
  // notificationType is 'moderation_result' exclusively for targetType
  // 'review') — a filled star reads as "about your review" at a glance,
  // distinct from report_resolved's generic checkmark below.
  moderation_result: <StarIcon size={17} filled />,
  report_resolved: <CheckIcon size={17} />,
  // Shared by every contribution decision (new_restaurant/edit_suggestion/
  // status_update/closure_report — one NotificationType covers all of
  // them), but new_restaurant is by far the most common, so a map-pin
  // ("new place") reads better here than the old camera glyph, which never
  // actually meant "photo" for this notification type.
  contribution_status: <MapPinIcon size={17} />,
  // Admin/moderator-facing (see NotificationService.notifyAdmins) — only
  // ever seen here if an admin/moderator account also browses the public
  // web app, since /me/notifications isn't role-scoped.
  moderation_queue_new: <AlertIcon size={17} />,
  review_helpful_vote: <ThumbsUpIcon size={17} />,
  review_helpful_milestone: <StarIcon size={17} filled />,
  restaurant_hours_changed: <ClockIcon size={17} />,
};

// Types whose deep-link `screen` is 'Reviews' (see NotificationDeepLink's own
// comment in shared-types) — these get the review-tab deep link instead of
// the plain restaurant page.
const REVIEW_SCREEN_TYPES: NotificationType[] = ['moderation_result', 'review_helpful_vote', 'review_helpful_milestone'];

// Everything else that's about a place rather than a review — a
// contribution's own decision (new_restaurant/edit_suggestion/status_update/
// closure_report, all sharing one NotificationType), and a favorited
// restaurant's hours changing.
const PLACE_SCREEN_TYPES: NotificationType[] = ['contribution_status', 'restaurant_hours_changed'];

type Filter = 'all' | 'unread' | 'reviews' | 'places';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function NotificationsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { filter: rawFilter } = await searchParams;
  const res = await backendFetchAuthorized('/me/notifications?page=1&pageSize=20');
  if (!res) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/notifications -> ${res.status}`);
  }
  const data = (await res.json()) as NotificationListResponse;

  const [t, tCommon] = await Promise.all([getTranslations('notifications'), getTranslations('common')]);

  // "Đánh giá"/"Địa điểm" only count what's on this fetched page (pageSize=20),
  // same approximation used elsewhere (e.g. Profile's contribution count)
  // rather than adding a backend `type` filter for these tabs.
  const reviewItems = data.items.filter((n) => REVIEW_SCREEN_TYPES.includes(n.type));
  const placeItems = data.items.filter((n) => PLACE_SCREEN_TYPES.includes(n.type));
  const unreadItems = data.items.filter((n) => !n.isRead);

  const filter: Filter =
    rawFilter === 'unread' || rawFilter === 'reviews' || rawFilter === 'places' ? rawFilter : 'all';
  const visibleItems =
    filter === 'unread' ? unreadItems : filter === 'reviews' ? reviewItems : filter === 'places' ? placeItems : data.items;
  const emptyText =
    filter === 'unread'
      ? t('emptyUnread')
      : filter === 'reviews'
        ? t('emptyReviews')
        : filter === 'places'
          ? t('emptyPlaces')
          : t('empty');

  const tabs: { key: Filter; href: string; label: string; count: number }[] = [
    { key: 'all', href: '/notifications', label: t('tabAll'), count: data.total },
    { key: 'unread', href: '/notifications?filter=unread', label: t('tabUnread'), count: data.unreadCount },
    { key: 'reviews', href: '/notifications?filter=reviews', label: t('tabReviews'), count: reviewItems.length },
    { key: 'places', href: '/notifications?filter=places', label: t('tabPlaces'), count: placeItems.length },
  ];

  // Resolves each notification's target restaurant to a real, public slug
  // — e.g. "your new restaurant was approved" can now link straight to it.
  // A restaurant that's still pending/rejected/deleted simply won't resolve
  // (only published restaurants come back), so it falls back to the plain
  // non-linked card, same as before. One batched request for every distinct
  // id on the page, not one request per notification.
  const restaurantIds = [...new Set(visibleItems.map((n) => n.payload.deepLink.restaurantId).filter((id): id is string => Boolean(id)))];
  const restaurantSlugById = await getRestaurantSlugsByIds(restaurantIds);

  return (
    <div className="container page-sections">
      <div className="notifications-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {t('title')}
          </h1>
          <p className="page-header-sub">{data.unreadCount > 0 ? t('unreadSubtitle', { count: data.unreadCount }) : t('allCaughtUp')}</p>
        </div>
        {data.unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="notification-mark-all-btn">
              {t('markRead')}
            </button>
          </form>
        ) : null}
      </div>

      <div className="notification-tabs">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} className={`notification-tab ${filter === tab.key ? 'notification-tab-active' : ''}`}>
            {tab.label}
            <span className="notification-tab-count">{tab.count}</span>
          </Link>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <div className="section-block-tight" style={{ marginTop: 0 }}>
          {visibleItems.map((notification) => {
            const slug = notification.payload.deepLink.restaurantId
              ? restaurantSlugById.get(notification.payload.deepLink.restaurantId)
              : null;
            // Review-screen notifications (a review of yours was decided,
            // marked helpful, or hit a helpful-vote milestone) deep-link
            // straight to the reviews tab; every other resolvable restaurant
            // link (e.g. contribution_status) goes to the plain restaurant page.
            const target = slug
              ? REVIEW_SCREEN_TYPES.includes(notification.type)
                ? `/restaurant/${slug}?tab=reviews`
                : `/restaurant/${slug}`
              : null;
            const body = (
              <>
                <span className="notification-title">{notification.payload.title}</span>
                <span className="notification-text">{notification.payload.body}</span>
                <span className="notification-time">{formatRelativeDate(notification.createdAt, locale)}</span>
              </>
            );
            // Unread + has a real destination: route through /open/[id] so the
            // single click both marks it read and navigates. Already-read
            // items skip that hop and link straight to the target. No
            // destination at all: not clickable (matches the old fallback).
            const href = target ? (notification.isRead ? target : `/notifications/open/${notification.id}?to=${encodeURIComponent(target)}`) : null;
            return (
              <div key={notification.id} className={`notification-item ${!notification.isRead ? 'notification-item-unread' : ''}`}>
                <span className={`notification-icon notification-icon-${notification.type}`} aria-hidden="true">
                  {NOTIFICATION_ICON[notification.type]}
                </span>
                {href ? (
                  <Link href={href} className="notification-body notification-body-link">
                    {body}
                  </Link>
                ) : (
                  <span className="notification-body">{body}</span>
                )}
                {!notification.isRead ? <span className="notification-dot" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
