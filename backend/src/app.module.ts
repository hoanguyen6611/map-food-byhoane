import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
import { FavoriteModule } from './modules/favorite/favorite.module';
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
    // Composite-score recompute job (build-prompts/06) runs as a worker
    // within this same process — a modular monolith at this scale doesn't
    // warrant a separate deployed worker (see docs/07-tech-stack.md §2).
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        );
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            // Local Redis needs neither of these, but a managed provider
            // (e.g. Upstash) requires both — dropping them silently broke
            // BullMQ's connection against any such REDIS_URL while /health
            // still reported redis:true (it pings a separately-configured
            // client, see RedisService, which parses the full URL correctly).
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
            // BullMQ's own requirement for any worker connection — without
            // this, ioredis's default retry limit can throw
            // MaxRetriesPerRequestError under the blocking commands BullMQ's
            // workers rely on.
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    // Domain modules — empty shells until their build-prompt module lands
    // (see docs/build-prompts/00-how-to-use.md and docs/05-system-architecture.md §3).
    AuthModule,
    UserModule,
    RestaurantModule,
    SearchModule,
    ReviewModule,
    FavoriteModule,
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
