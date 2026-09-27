import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import type { LeaderboardResponse, PublicProfileDto, PublicProfileReviewListResponse } from '@foodmap/shared-types';
import type { JwtPayload } from '../auth/auth.types';
import { UserPublicService } from './user-public.service';
import { GamificationService } from './gamification.service';
import { MyReviewListQueryDto } from '../review/dto/my-review-list-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_LEADERBOARD_LIMIT = 20;

// Public counterpart to UserController's `/me` (self-only, JwtAuthGuard) —
// no class-level guard: anyone (including a logged-out visitor) can view a
// public profile. Optional-auth (best-effort JWT decode, never required)
// follows the exact recipe SearchController already established for
// "behaves differently if logged in, but never requires it".
@ApiTags('Users')
@Controller('users')
export class UserPublicController {
  constructor(
    private readonly userPublicService: UserPublicService,
    private readonly gamificationService: GamificationService,
    private readonly jwt: JwtService,
  ) {}

  // Must stay declared before the `:id` route below — Nest matches routes in
  // declaration order, so `:id` would otherwise swallow `/users/leaderboard`
  // as id="leaderboard".
  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string): Promise<LeaderboardResponse> {
    const parsed = limit ? Number(limit) : DEFAULT_LEADERBOARD_LIMIT;
    const items = await this.gamificationService.getLeaderboard(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : DEFAULT_LEADERBOARD_LIMIT,
    );
    return { items };
  }

  @Get(':id')
  getProfile(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<PublicProfileDto> {
    return this.userPublicService.getProfile(id, this.tryExtractUserId(authHeader));
  }

  @Get(':id/reviews')
  listReviews(
    @Param('id') id: string,
    @Query() query: MyReviewListQueryDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<PublicProfileReviewListResponse> {
    return this.userPublicService.listReviews(
      id,
      this.tryExtractUserId(authHeader),
      query.page ?? DEFAULT_PAGE,
      query.pageSize ?? DEFAULT_PAGE_SIZE,
    );
  }

  // Same best-effort decode as SearchController.tryExtractUserId — a public
  // route's optional-auth is never a hard requirement, only ever used to
  // compute `isFollowedByViewer`/the private-profile self-preview bypass.
  private tryExtractUserId(authHeader?: string): string | undefined {
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<JwtPayload>(authHeader.slice('Bearer '.length));
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
