import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

// Favorites (build-prompts/08-favorites-notifications-polish.md) join this
// module later — profile/account concerns are implemented now per
// build-prompts/02-auth.md. MediaModule imported so UserService can resolve
// an avatar's `Photo.storageKey` into a real URL via its exported
// `MediaService.resolveUrl` — the same reuse path RestaurantService already
// takes for restaurant/review photos.
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
