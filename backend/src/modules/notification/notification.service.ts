import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationDto, NotificationListResponse, NotificationPayload, NotificationType } from '@foodmap/shared-types';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE): Promise<NotificationListResponse> {
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
  async create(userId: string, type: NotificationType, payload: NotificationPayload): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, payload: payload as unknown as Prisma.InputJsonValue },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
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
      type: row.type as NotificationType,
      payload: row.payload as unknown as NotificationPayload,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
