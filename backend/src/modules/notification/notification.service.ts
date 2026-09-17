import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  NotificationDto,
  NotificationListResponse,
  NotificationPayload,
  NotificationType,
} from '@foodmap/shared-types';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushDeliveryService } from './push-delivery.service';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

  async list(
    userId: string,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<NotificationListResponse> {
    const where = { userId };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  // First real producer: the Admin Moderation Queue's decision endpoint
  // (build-prompts/07). Previously only prisma/seed-notifications.ts wrote
  // rows directly for demo purposes — this is the actual application code path.
  async create(
    userId: string,
    type: NotificationType,
    payload: NotificationPayload,
  ): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    // Push delivery is best-effort and must never block/fail notification
    // creation — same "downstream integration failure never breaks the core
    // flow" shape as the AI moderation calls elsewhere in this codebase.
    // Wired here (the single choke point every notification passes through)
    // so any future producer gets push delivery for free.
    try {
      await this.pushDelivery.sendToUser(userId, payload, notification.id);
    } catch (error) {
      this.logger.error(
        'Push delivery failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // Fan-out producer for admin-facing alerts (moderation_queue_new) — every
  // other notification type targets a single contributor via create().
  // Reuses create() per admin so push delivery stays wired through its one
  // choke point; admins typically have no PushToken rows registered, so
  // that call is a harmless no-op for them today.
  async notifyAdmins(
    type: NotificationType,
    payload: NotificationPayload,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { code: { in: ['admin', 'moderator'] } },
        status: 'active',
      },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) => this.create(admin.id, type, payload)),
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return this.toDto(updated);
  }

  private toDto(row: Notification): NotificationDto {
    return {
      id: row.id,
      type: row.type,
      payload: row.payload as unknown as NotificationPayload,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
