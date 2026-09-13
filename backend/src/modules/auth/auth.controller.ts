import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthResponse } from '@foodmap/shared-types';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RateLimit } from './decorators/rate-limit.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimit({ limit: 5, windowSeconds: 900, keyPrefix: 'register' })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, windowSeconds: 900, keyPrefix: 'login' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  oauthGoogle(@Body() dto: OAuthLoginDto): Promise<AuthResponse> {
    return this.authService.oauthLogin('google', dto.idToken);
  }

  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  oauthApple(@Body() dto: OAuthLoginDto): Promise<AuthResponse> {
    return this.authService.oauthLogin('apple', dto.idToken);
  }

  @Post('oauth/facebook')
  @HttpCode(HttpStatus.OK)
  oauthFacebook(@Body() dto: OAuthLoginDto): Promise<AuthResponse> {
    return this.authService.oauthLogin('facebook', dto.idToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto): Promise<{ success: true }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, windowSeconds: 900, keyPrefix: 'forgot-password' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    // Identical response whether or not the account exists (no user
    // enumeration), per docs/01-prd-mvp.md §10.1.
    return {
      message: 'Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }
}
