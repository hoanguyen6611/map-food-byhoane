import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { PermissionsService } from './permissions.service';
import { GoogleOAuthService } from './oauth/google-oauth.service';
import { AppleOAuthService } from './oauth/apple-oauth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // `expiresIn` is typed by @types/jsonwebtoken as a branded string
        // literal union, not `string` — our value comes from env config, so
        // the cast is a deliberate, narrow escape from an overly strict type.
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_TTL',
            '15m',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    RateLimitGuard,
    PermissionsService,
    GoogleOAuthService,
    AppleOAuthService,
  ],
  // Exported so RestaurantModule/ReviewModule/AdminModule etc. (later
  // modules) can apply @UseGuards(JwtAuthGuard, RolesGuard/PermissionsGuard)
  // without re-declaring providers. JwtModule is re-exported so modules that
  // need OPTIONAL auth (e.g. SearchModule attributing SearchHistory to a
  // logged-in user without requiring login) can inject JwtService directly,
  // without a full guard.
  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    PermissionsService,
  ],
})
export class AuthModule {}
