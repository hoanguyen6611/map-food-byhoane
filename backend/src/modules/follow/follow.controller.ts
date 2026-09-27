import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FollowActionResponse } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { FollowService } from './follow.service';

@ApiTags('Follow')
@ApiBearerAuth('access-token')
@Controller('users/:id/follow')
@UseGuards(JwtAuthGuard)
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post()
  follow(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FollowActionResponse> {
    return this.followService.follow(user.id, id);
  }

  @Delete()
  unfollow(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<FollowActionResponse> {
    return this.followService.unfollow(user.id, id);
  }
}
