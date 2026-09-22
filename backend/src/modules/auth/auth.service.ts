import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, RoleCode } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleOAuthService } from './oauth/google-oauth.service';
import { AppleOAuthService } from './oauth/apple-oauth.service';
import { FacebookOAuthService } from './oauth/facebook-oauth.service';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './crypto.util';
import { parseDurationToMs } from './duration.util';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly appleOAuth: AppleOAuthService,
    private readonly facebookOAuth: FacebookOAuthService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const role = await this.prisma.role.findUniqueOrThrow({
      where: { code: 'user' },
    });
    const passwordHash = await hashPassword(dto.password);
    const displayName = dto.displayName?.trim() || dto.email.split('@')[0];

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        roleId: role.id,
        profile: { create: { displayName } },
      },
    });

    return this.issueSession(user.id, user.email, role.code, role.id, user.createdAt);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { role: true },
    });

    // Generic message regardless of *why* it failed (no account, OAuth-only
    // account with no password, wrong password) — never reveal which case.
    const genericError = () =>
      new UnauthorizedException('Email hoặc mật khẩu không đúng');

    if (!user || !user.passwordHash) {
      throw genericError();
    }
    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw genericError();
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueSession(user.id, user.email, user.role.code, user.roleId, user.createdAt);
  }

  async oauthLogin(
    provider: 'google' | 'apple' | 'facebook',
    idToken: string,
  ): Promise<AuthResponse> {
    const identity = await (provider === 'google'
      ? this.googleOAuth.verify(idToken)
      : provider === 'apple'
        ? this.appleOAuth.verify(idToken)
        : this.facebookOAuth.verify(idToken));

    let user = await this.prisma.user.findFirst({
      where: { oauthProvider: provider, oauthSubjectId: identity.subjectId },
      include: { role: true },
    });

    if (!user) {
      // Link to an existing email/password (or other-provider) account if
      // one exists, per the "one account per email" business rule, rather
      // than creating a duplicate identity for the same person.
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: identity.email },
        include: { role: true },
      });

      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { oauthProvider: provider, oauthSubjectId: identity.subjectId },
          include: { role: true },
        });
      } else {
        const role = await this.prisma.role.findUniqueOrThrow({
          where: { code: 'user' },
        });
        const displayName = identity.email.split('@')[0];
        user = await this.prisma.user.create({
          data: {
            email: identity.email,
            oauthProvider: provider,
            oauthSubjectId: identity.subjectId,
            roleId: role.id,
            profile: { create: { displayName } },
          },
          include: { role: true },
        });
      }
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueSession(user.id, user.email, user.role.code, user.roleId, user.createdAt);
  }

  async refresh(refreshTokenPlain: string): Promise<AuthResponse> {
    const tokenHash = hashOpaqueToken(refreshTokenPlain);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    if (stored.user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }

    const session = await this.issueSession(
      stored.user.id,
      stored.user.email,
      stored.user.role.code,
      stored.user.roleId,
      stored.user.createdAt,
    );

    // Rotate: the old token is now dead. Rotation happens *after* issuing the
    // new one so a crash mid-request can't leave the user with zero valid
    // tokens, and we can record which token replaced this one for audit.
    const newHash = hashOpaqueToken(session.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newHash },
    });

    return session;
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const tokenHash = hashOpaqueToken(refreshTokenPlain);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Always behave the same way whether or not the account exists — the
    // caller (controller) returns an identical response either way.
    if (!user) return;

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes, per PRD
      },
    });

    // MVP stub: no transactional email provider wired up yet (out of scope
    // per docs/build-prompts/02-auth.md) — log the link so it's usable in
    // local dev. Swap for a real email send in a later module.
    this.logger.log(
      `Password reset requested for ${user.email}. Reset link (dev only): ` +
        `/reset-password?token=${token}`,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Resetting the password invalidates all existing sessions — a
      // reasonable security default (e.g. in case the reset was triggered
      // because of a compromised device/session).
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueSession(
    userId: string,
    email: string,
    role: RoleCode,
    roleId: string,
    createdAt: Date,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, roleId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // See auth.module.ts for why this cast is necessary.
        expiresIn: this.config.get<string>(
          'JWT_ACCESS_TTL',
          '15m',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshTokenPlain = generateOpaqueToken();
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(refreshTokenPlain),
        expiresAt: new Date(Date.now() + parseDurationToMs(refreshTtl)),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      user: { id: userId, email, role, status: 'active', createdAt: createdAt.toISOString() },
    };
  }
}
