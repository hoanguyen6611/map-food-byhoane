import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { NotificationDto, NotificationListResponse } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';

@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: NotificationListQueryDto): Promise<NotificationListResponse> {
    return this.notificationService.list(user.id, query.page, query.pageSize);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<NotificationDto> {
    return this.notificationService.markRead(user.id, id);
  }
}
