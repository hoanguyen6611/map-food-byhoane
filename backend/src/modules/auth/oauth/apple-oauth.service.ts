import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VerifiedOAuthIdentity } from './google-oauth.service';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

// Verifies an Apple ID token issued to the mobile client by native
// "Sign in with Apple" — checked against Apple's published JWKS, never
// trusted as-is. Note: Apple only includes `email` on the *first* sign-in
// for a given app; the client is responsible for caching it thereafter if
// needed (out of scope here — this service only authenticates identity).
@Injectable()
export class AppleOAuthService {
  private readonly jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('APPLE_OAUTH_CLIENT_ID', '');
  }

  async verify(idToken: string): Promise<VerifiedOAuthIdentity> {
    if (!this.clientId) {
      throw new UnauthorizedException(
        'Apple OAuth chưa được cấu hình trên máy chủ',
      );
    }
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.clientId,
      });
      const subjectId = payload.sub;
      const email =
        typeof payload.email === 'string'
          ? payload.email.toLowerCase()
          : undefined;
      if (!subjectId || !email) {
        throw new UnauthorizedException('Apple ID token không hợp lệ');
      }
      return { subjectId, email };
    } catch {
      throw new UnauthorizedException(
        'Apple ID token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
