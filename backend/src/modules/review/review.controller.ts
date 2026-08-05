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
import type { ReviewDto, ReviewListResponse } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { RateLimit } from '../auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewListQueryDto } from './dto/review-list-query.dto';

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
