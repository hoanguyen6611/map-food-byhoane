import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { WebPushConfigDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { WebPushService } from './web-push.service';
import {
  RegisterWebPushSubscriptionDto,
  RemoveWebPushSubscriptionDto,
} from './dto/web-push-subscription.dto';

/** Public: the VAPID key the browser subscribes with (null = web push off). */
@ApiTags('Web Push')
@Controller('push/web')
export class WebPushConfigController {
  constructor(private readonly webPush: WebPushService) {}

  @Get('config')
  getConfig(): WebPushConfigDto {
    return { publicKey: this.webPush.getPublicKey() };
  }
}

@ApiTags('Web Push')
@ApiBearerAuth('access-token')
@Controller('me/web-push-subscriptions')
@UseGuards(JwtAuthGuard)
export class WebPushSubscriptionController {
  constructor(private readonly prisma: PrismaService) {}

  // Upsert on the globally-unique endpoint — same browser signing in as a
  // different account re-points its one subscription (PushTokenController's
  // convention), never delivers to both.
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @Body() dto: RegisterWebPushSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    const data = {
      userId: user.id,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent ?? null,
    };
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: data,
      create: { ...data, endpoint: dto.endpoint },
    });
  }

  // POST rather than DELETE-with-body (some proxies strip DELETE bodies).
  // Idempotent and scoped to the caller's own rows.
  @Post('remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Body() dto: RemoveWebPushSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.prisma.webPushSubscription.deleteMany({
      where: { endpoint: dto.endpoint, userId: user.id },
    });
  }
}
