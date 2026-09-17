import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { NotificationPayload } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

// Sends a push for every notification NotificationService.create() writes —
// see that method's call site. Deliberately isolated behind this service (not
// inlined) so a push-delivery failure can never break the underlying
// notification write, matching this codebase's existing resilience pattern
// for downstream integrations (PhotoModerationService/ReviewModerationService
// never let an AI-provider failure block the core flow either).
//
// What this cannot do in this environment: actually verify a push arrives on
// a device. That needs a physical iOS device (the Simulator has no APNs
// connectivity at all) plus a real Apple Developer Program push key
// registered via EAS credentials — neither exists here. This service sends
// correctly per Expo's push API contract; delivery past that point is
// unverified.
@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
    notificationId: string,
  ): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = [];
    const messageTokens: string[] = [];
    for (const { token } of tokens) {
      if (!Expo.isExpoPushToken(token)) {
        this.logger.warn(`Skipping malformed push token for user ${userId}`);
        continue;
      }
      messages.push({
        to: token,
        title: payload.title,
        body: payload.body,
        data: { notificationId, deepLink: payload.deepLink },
      });
      messageTokens.push(token);
    }
    if (messages.length === 0) return;

    const staleTokens: string[] = [];
    const chunks = this.expo.chunkPushNotifications(messages);
    let cursor = 0;
    for (const chunk of chunks) {
      const chunkTokens = messageTokens.slice(cursor, cursor + chunk.length);
      cursor += chunk.length;
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            staleTokens.push(chunkTokens[index]);
          }
        });
      } catch (error) {
        // Never let a delivery failure propagate to the caller — the
        // notification row is already written regardless of push outcome.
        this.logger.error(
          'Expo push send failed',
          error instanceof Error ? error.stack : error,
        );
      }
    }

    if (staleTokens.length > 0) {
      await this.prisma.pushToken.deleteMany({
        where: { token: { in: staleTokens } },
      });
    }
  }
}
