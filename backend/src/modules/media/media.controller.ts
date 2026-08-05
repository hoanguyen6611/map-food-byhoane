import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import type { CreateUploadUrlResponse, PhotoDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { MediaService } from './media.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

// Real signed-upload pipeline (build-prompts/07) — any authenticated user
// may upload; ownership is checked per-photo in-service, not via @Roles.
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  createUploadUrl(
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateUploadUrlResponse> {
    return this.mediaService.createUploadUrl(user.id, dto.contentType, dto.fileSizeBytes);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmUploadDto, @CurrentUser() user: RequestUser): Promise<PhotoDto> {
    return this.mediaService.confirm(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.mediaService.remove(user.id, id, user.role === 'admin' || user.role === 'moderator');
  }
}
