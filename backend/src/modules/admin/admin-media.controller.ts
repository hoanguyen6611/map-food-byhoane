import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AdminMediaService,
  type ImageKitUploadAuth,
} from './admin-media.service';

@ApiTags('Admin: Media')
@ApiBearerAuth('access-token')
@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator', 'owner')
export class AdminMediaController {
  constructor(private readonly adminMediaService: AdminMediaService) {}

  // Stateless signed-upload credentials, not restaurant-scoped — safe to
  // extend to 'owner' here (no resource-ownership check needed, unlike the
  // actual attach/remove routes on OwnerRestaurantController which ARE
  // restaurant-scoped).
  @Get('imagekit-auth')
  getImageKitAuth(): ImageKitUploadAuth {
    return this.adminMediaService.getUploadAuth();
  }
}
