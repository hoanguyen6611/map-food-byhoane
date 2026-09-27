import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  OwnerRestaurantDetailDto,
  OwnerRestaurantListItemDto,
  OwnerRestaurantStatsDto,
  PhotoDto,
} from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnerRestaurantGuard } from '../auth/guards/owner-restaurant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { OwnerRestaurantService } from './owner-restaurant.service';
import { AttachPhotoDto } from './dto/attach-photo.dto';
import { SetCoverPhotoDto } from './dto/set-cover-photo.dto';

// Restaurant Owner self-service dashboard (admin-web's /owner/* section).
// Every route below either needs no resource id (`GET /owner/restaurants`,
// gated purely by role) or carries a restaurant id and is gated by
// OwnerRestaurantGuard, which 403s unless request.user owns that specific
// restaurant — deliberately separate from AdminRestaurantController's
// staff-only @Roles('admin','moderator') routes rather than retrofitting
// per-resource checks into that controller.
@ApiTags('Owner: Restaurants')
@ApiBearerAuth('access-token')
@Controller('owner/restaurants')
@UseGuards(JwtAuthGuard)
export class OwnerRestaurantController {
  constructor(private readonly ownerRestaurantService: OwnerRestaurantService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner')
  listMine(@CurrentUser() user: RequestUser): Promise<OwnerRestaurantListItemDto[]> {
    return this.ownerRestaurantService.listMine(user.id);
  }

  @Get(':id')
  @UseGuards(OwnerRestaurantGuard)
  getDetail(@Param('id') id: string): Promise<OwnerRestaurantDetailDto> {
    return this.ownerRestaurantService.getDetail(id);
  }

  @Get(':id/stats')
  @UseGuards(OwnerRestaurantGuard)
  getStats(@Param('id') id: string): Promise<OwnerRestaurantStatsDto> {
    return this.ownerRestaurantService.getStats(id);
  }

  @Post(':id/photos')
  @UseGuards(OwnerRestaurantGuard)
  attachPhoto(
    @Param('id') id: string,
    @Body() dto: AttachPhotoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PhotoDto> {
    return this.ownerRestaurantService.attachPhoto(id, dto, user.id);
  }

  @Post(':id/menu-photos')
  @UseGuards(OwnerRestaurantGuard)
  attachMenuPhoto(
    @Param('id') id: string,
    @Body() dto: AttachPhotoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PhotoDto> {
    return this.ownerRestaurantService.attachMenuPhoto(id, dto, user.id);
  }

  @Put(':id/cover-photo')
  @UseGuards(OwnerRestaurantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  setCoverPhoto(
    @Param('id') id: string,
    @Body() dto: SetCoverPhotoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.ownerRestaurantService.setCoverPhoto(id, dto, user.id);
  }

  @Delete(':id/photos/:photoId')
  @UseGuards(OwnerRestaurantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.ownerRestaurantService.removePhoto(id, photoId, user.id);
  }
}
