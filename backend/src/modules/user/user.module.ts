import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

// Favorites (build-prompts/08-favorites-notifications-polish.md) join this
// module later — profile/account concerns are implemented now per
// build-prompts/02-auth.md.
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
