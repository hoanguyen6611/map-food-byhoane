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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AdminRestaurantDetailDto,
  AdminRestaurantListItemDto,
  MenuItemDto,
  Paginated,
  PhotoDto,
} from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminRestaurantService } from './admin-restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { AdminRestaurantQueryDto } from './dto/admin-restaurant-query.dto';
import { ReplaceOpeningHoursDto } from './dto/opening-hours.dto';
import { ReplaceFacilitiesDto } from './dto/facilities.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { AttachPhotoDto } from './dto/attach-photo.dto';
import { SetCoverPhotoDto } from './dto/set-cover-photo.dto';

// `admin` and `moderator` share every action here EXCEPT hard delete
// (see the DELETE :id handler below) — that split is the explicit
// Definition-of-Done requirement in docs/build-prompts/05.
@ApiTags('Admin: Restaurants')
@ApiBearerAuth('access-token')
@Controller('admin/restaurants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminRestaurantController {
  constructor(
    private readonly adminRestaurantService: AdminRestaurantService,
  ) {}

  @Get()
  list(
    @Query() query: AdminRestaurantQueryDto,
  ): Promise<Paginated<AdminRestaurantListItemDto>> {
    return this.adminRestaurantService.list(query);
  }

  @Get(':id')
  getDetail(@Param('id') id: string): Promise<AdminRestaurantDetailDto> {
    return this.adminRestaurantService.getDetail(id);
  }

  @Post()
  create(
    @Body() dto: CreateRestaurantDto,
    @CurrentUser() user: RequestUser,
  ): Promise<AdminRestaurantDetailDto> {
    return this.adminRestaurantService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser() user: RequestUser,
  ): Promise<AdminRestaurantDetailDto> {
    return this.adminRestaurantService.update(id, dto, user.id);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  hide(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.hide(id, user.id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.restore(id, user.id);
  }

  // Admin-only override on top of the class-level @Roles('admin','moderator') —
  // a `moderator` account hitting this route gets a 403 from RolesGuard.
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.remove(id, user.id);
  }

  @Put(':id/opening-hours')
  @HttpCode(HttpStatus.NO_CONTENT)
  replaceOpeningHours(
    @Param('id') id: string,
    @Body() dto: ReplaceOpeningHoursDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.replaceOpeningHours(id, dto, user.id);
  }

  @Put(':id/facilities')
  @HttpCode(HttpStatus.NO_CONTENT)
  replaceFacilities(
    @Param('id') id: string,
    @Body() dto: ReplaceFacilitiesDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.replaceFacilities(id, dto, user.id);
  }

  @Post(':id/menu-items')
  addMenuItem(
    @Param('id') id: string,
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: RequestUser,
  ): Promise<MenuItemDto> {
    return this.adminRestaurantService.addMenuItem(id, dto, user.id);
  }

  // Not nested under :restaurantId — menu item ids are already globally
  // unique (Prisma cuid), and admin-web's menu editor addresses items directly.
  @Patch('menu-items/:itemId')
  updateMenuItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: RequestUser,
  ): Promise<MenuItemDto> {
    return this.adminRestaurantService.updateMenuItem(itemId, dto, user.id);
  }

  @Delete('menu-items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMenuItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.removeMenuItem(itemId, user.id);
  }

  @Post(':id/photos')
  attachPhoto(
    @Param('id') id: string,
    @Body() dto: AttachPhotoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PhotoDto> {
    return this.adminRestaurantService.attachPhoto(id, dto, user.id);
  }

  @Delete('photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(
    @Param('photoId') photoId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.removePhoto(photoId, user.id);
  }

  @Put(':id/cover-photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  setCoverPhoto(
    @Param('id') id: string,
    @Body() dto: SetCoverPhotoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminRestaurantService.setCoverPhoto(id, dto.photoId, user.id);
  }
}
