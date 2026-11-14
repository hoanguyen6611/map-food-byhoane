import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import type { NotificationPayload, NotificationType } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Same set the web Notifications page sends to the restaurant's reviews tab
 * (web/src/app/[locale]/notifications/page.tsx REVIEW_SCREEN_TYPES) — kept
 * in sync by hand so tapping a push lands where tapping the in-app card does.
 */
const REVIEW_SCREEN_TYPES: NotificationType[] = [
  'moderation_result',
  'review_helpful_vote',
  'review_helpful_milestone',
  'review_reply',
];

/** Body the web service worker (web/public/sw.js) reads in its `push` handler. */
export interface WebPushMessage {
  title: string;
  body: string;
  /** Same-origin path; goes through /notifications/open/:id so a tap also marks it read. */
  url: string;
  notificationId: string;
}

/**
 * Web Push (VAPID) delivery for the public web app — the browser
 * counterpart of PushDeliveryService's Expo path. Disabled (silent no-op)
 * until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are configured, so deploying
 * this without keys changes nothing. Generate a pair once with
 * `npx web-push generate-vapid-keys`; rotating them invalidates every
 * existing browser subscription.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string | null;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY')?.trim() || null;
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY')?.trim() || null;
    const subject = config.get<string>('VAPID_SUBJECT')?.trim() || 'mailto:admin@foodmap.local';
    this.publicKey = publicKey;
    this.enabled = false;
    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.enabled = true;
      } catch (error) {
        this.logger.error('Invalid VAPID configuration — web push disabled', error instanceof Error ? error.stack : error);
      }
    }
  }

  /** Null while web push isn't configured — the web app then hides its "Bật thông báo" control. */
  getPublicKey(): string | null {
    return this.enabled ? this.publicKey : null;
  }

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
    notificationId: string,
    type: NotificationType,
  ): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.prisma.webPushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const message: WebPushMessage = {
      title: payload.title,
      body: payload.body,
      url: await this.buildUrl(payload, notificationId, type),
      notificationId,
    };
    const body = JSON.stringify(message);

    const stale: string[] = [];
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: 'normal' },
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          // 404/410 = the browser dropped this subscription (permission
          // revoked, site data cleared, PWA uninstalled) — same cleanup as
          // Expo's DeviceNotRegistered.
          if (statusCode === 404 || statusCode === 410) {
            stale.push(sub.endpoint);
          } else {
            this.logger.warn(`Web push send failed (${statusCode ?? 'network'}) for user ${userId}`);
          }
        }
      }),
    );

    if (stale.length > 0) {
      await this.prisma.webPushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    }
  }

  /** Mirrors the web Notifications page's card target resolution. */
  private async buildUrl(
    payload: NotificationPayload,
    notificationId: string,
    type: NotificationType,
  ): Promise<string> {
    const { restaurantId, userId } = payload.deepLink;
    let target = '/notifications';
    if (restaurantId) {
      const restaurant = await this.prisma.restaurant.findFirst({
        where: { id: restaurantId, deletedAt: null, status: { publicationStatus: 'published' } },
        select: { slug: true },
      });
      if (restaurant) {
        target = REVIEW_SCREEN_TYPES.includes(type)
          ? `/restaurant/${restaurant.slug}?tab=reviews`
          : `/restaurant/${restaurant.slug}`;
      } else if (userId) {
        target = `/profile/${userId}`;
      }
    } else if (userId) {
      target = `/profile/${userId}`;
    }
    return `/notifications/open/${notificationId}?to=${encodeURIComponent(target)}`;
  }
}
