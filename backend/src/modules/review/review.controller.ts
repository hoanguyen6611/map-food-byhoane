import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MyReviewListResponse, ReviewDto, ReviewListResponse } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { RateLimit } from '../auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewListQueryDto } from './dto/review-list-query.dto';
import { MyReviewListQueryDto } from './dto/my-review-list-query.dto';

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // Rate-limited per docs/09-testing-plan.md §4 Security Checklist ("review
  // submission" is explicitly listed) — 10/hour per IP is generous for a
  // real user, tight enough to blunt a review-spam script.
  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 3600, keyPrefix: 'review-create' })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: RequestUser): Promise<ReviewDto> {
    return this.reviewService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ReviewDto> {
    return this.reviewService.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.reviewService.remove(id, user.id);
  }
}

// Separate controller (not nested under RestaurantController) so
// RestaurantModule doesn't need to depend on ReviewModule for this one
// route — public, no auth required.
@ApiTags('Reviews')
@Controller('restaurants/:restaurantId/reviews')
export class RestaurantReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  list(
    @Param('restaurantId') restaurantId: string,
    @Query() query: ReviewListQueryDto,
  ): Promise<ReviewListResponse> {
    return this.reviewService.listForRestaurant(restaurantId, query);
  }
}

// Separate controller (not nested under `reviews`) for the same reason
// FavoriteController/NotificationController live at `me/...` paths — this
// is a profile-scoped route, not a review-resource route.
@ApiTags('My Reviews')
@ApiBearerAuth('access-token')
@Controller('me/reviews')
@UseGuards(JwtAuthGuard)
export class MyReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  listMine(@CurrentUser() user: RequestUser, @Query() query: MyReviewListQueryDto): Promise<MyReviewListResponse> {
    return this.reviewService.listMine(user.id, query.page, query.pageSize);
  }
}
