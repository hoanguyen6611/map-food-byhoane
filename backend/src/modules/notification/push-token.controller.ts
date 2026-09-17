import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Push Tokens')
@ApiBearerAuth('access-token')
@Controller('me/push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokenController {
  constructor(private readonly prisma: PrismaService) {}

  // Upsert on the token's own unique constraint, not (userId, token) — the
  // same device reinstalling/re-logging-in under a different account must
  // re-point its one Expo push token to the new user, not accumulate stale
  // rows under the old one.
  @Post()
  async register(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: { userId: user.id, platform: dto.platform },
      create: { userId: user.id, token: dto.token, platform: dto.platform },
    });
  }

  // Called on logout so a signed-out device stops receiving that user's
  // pushes. Idempotent — unregistering a token that isn't there (or belongs
  // to someone else) just reflects the already-true end state, no error,
  // mirroring FavoriteService's add/remove idempotency convention.
  @Delete(':token')
  async unregister(
    @Param('token') token: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.prisma.pushToken.deleteMany({
      where: { token, userId: user.id },
    });
  }
}
