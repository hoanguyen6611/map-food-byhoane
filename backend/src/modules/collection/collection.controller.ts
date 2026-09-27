import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  CollectionDetailDto,
  CollectionListResponse,
  CollectionSummaryDto,
} from '@foodmap/shared-types';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@ApiTags('Collections')
@Controller()
export class CollectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly jwt: JwtService,
  ) {}

  @Post('collections')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCollectionDto, @CurrentUser() user: RequestUser): Promise<CollectionSummaryDto> {
    return this.collectionService.create(user.id, dto.name, dto.description);
  }

  @Get('me/collections')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: RequestUser): Promise<CollectionListResponse> {
    return this.collectionService.listMine(user.id);
  }

  // Public — no class-level guard: a collection's own `isPublic` flag (not
  // a route guard) decides visibility. Optional-auth (best-effort JWT
  // decode) same recipe as SearchController/UserPublicController, needed
  // only to compute `isOwner` and to let the owner preview their own
  // private collection.
  @Get('collections/:id')
  getDetail(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<CollectionDetailDto> {
    return this.collectionService.getDetail(id, this.tryExtractUserId(authHeader));
  }

  @Patch('collections/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CollectionSummaryDto> {
    return this.collectionService.update(id, user.id, dto);
  }

  @Delete('collections/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.collectionService.remove(id, user.id);
  }

  @Post('collections/:id/items/:restaurantId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  addItem(
    @Param('id') id: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.collectionService.addItem(id, user.id, restaurantId);
  }

  @Delete('collections/:id/items/:restaurantId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @Param('id') id: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.collectionService.removeItem(id, user.id, restaurantId);
  }

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
