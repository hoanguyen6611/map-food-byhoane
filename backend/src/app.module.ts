import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { SearchModule } from './modules/search/search.module';
import { ReviewModule } from './modules/review/review.module';
import { MediaModule } from './modules/media/media.module';
import { ContributionModule } from './modules/contribution/contribution.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    // Domain modules — empty shells until their build-prompt module lands
    // (see docs/build-prompts/00-how-to-use.md and docs/05-system-architecture.md §3).
    AuthModule,
    UserModule,
    RestaurantModule,
    SearchModule,
    ReviewModule,
    MediaModule,
    ContributionModule,
    ModerationModule,
    NotificationModule,
    AiModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
