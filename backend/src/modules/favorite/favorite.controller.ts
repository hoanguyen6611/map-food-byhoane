import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { FavoriteListResponse, FavoriteStatusDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { FavoriteService } from './favorite.service';
import { FavoriteListQueryDto } from './dto/favorite-list-query.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post('favorites/:restaurantId')
  add(@Param('restaurantId') restaurantId: string, @CurrentUser() user: RequestUser): Promise<FavoriteStatusDto> {
    return this.favoriteService.add(user.id, restaurantId);
  }

  @Delete('favorites/:restaurantId')
  remove(@Param('restaurantId') restaurantId: string, @CurrentUser() user: RequestUser): Promise<FavoriteStatusDto> {
    return this.favoriteService.remove(user.id, restaurantId);
  }

  @Get('me/favorites')
  list(@CurrentUser() user: RequestUser, @Query() query: FavoriteListQueryDto): Promise<FavoriteListResponse> {
    return this.favoriteService.list(user.id, query.page, query.pageSize);
  }

  // Unpaginated restaurantId list — lets any screen (map, search results,
  // list) build a client-side Set for O(1) "is this favorited?" checks
  // without an N+1 request per card or missing entries past page 1 of the
  // paginated list above.
  @Get('me/favorites/ids')
  listIds(@CurrentUser() user: RequestUser): Promise<string[]> {
    return this.favoriteService.listIds(user.id);
  }
}
