import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MeResponse } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

@ApiTags('User (me)')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getMe(@CurrentUser() user: RequestUser): Promise<MeResponse> {
    return this.userService.getMe(user);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    return this.userService.updateProfile(user, dto);
  }

  @Patch('avatar')
  updateAvatar(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAvatarDto,
  ): Promise<MeResponse> {
    return this.userService.updateAvatar(user, dto.photoUrl ?? null);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: RequestUser): Promise<void> {
    await this.userService.deleteAccount(user);
  }
}
