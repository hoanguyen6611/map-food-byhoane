import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  NotificationDto,
  NotificationListResponse,
} from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notificationService.list(user.id, query.page, query.pageSize);
  }

  // Declared before `:id/read` in the file but that's irrelevant here — the
  // two routes are structurally distinct (`read-all` has one segment,
  // `:id/read` always has two), so there's no matching ambiguity either way.
  @Patch('read-all')
  markAllRead(@CurrentUser() user: RequestUser): Promise<void> {
    return this.notificationService.markAllRead(user.id);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<NotificationDto> {
    return this.notificationService.markRead(user.id, id);
  }
}
