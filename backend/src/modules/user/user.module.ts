import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { ReviewModule } from '../review/review.module';
import { UserController } from './user.controller';
import { UserPublicController } from './user-public.controller';
import { UserService } from './user.service';
import { UserPublicService } from './user-public.service';
import { GamificationService } from './gamification.service';

// Favorites (build-prompts/08-favorites-notifications-polish.md) join this
// module later — profile/account concerns are implemented now per
// build-prompts/02-auth.md. MediaModule imported so UserService can resolve
// an avatar's `Photo.storageKey` into a real URL via its exported
// `MediaService.resolveUrl` — the same reuse path RestaurantService already
// takes for restaurant/review photos. AuthModule also re-exports JwtModule,
// used by UserPublicController's optional-auth (no guard, best-effort JWT
// decode — same recipe as SearchController). ReviewModule is imported for
// ReviewService (public profile's "reviews by this user" list).
@Module({
  imports: [AuthModule, MediaModule, ReviewModule],
  controllers: [UserController, UserPublicController],
  providers: [UserService, UserPublicService, GamificationService],
})
export class UserModule {}
