import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VerifiedOAuthIdentity } from './google-oauth.service';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

// Verifies an Apple ID token issued to the mobile client by native
// "Sign in with Apple", or to the web client by Sign in with Apple JS —
// checked against Apple's published JWKS, never trusted as-is. Apple issues
// a distinct client id per platform (the app's Bundle/App ID vs a web
// "Services ID"), so the token's `aud` differs by client; `sub` is stable
// per Apple Developer Team regardless, as long as the Services ID and App
// ID are grouped under the same primary App ID in Apple's dashboard (a
// one-time Apple Developer console configuration step, not a code concern).
// Note: Apple only includes `email` on the *first* sign-in for a given
// client id — the caller is responsible for caching it thereafter if
// needed (out of scope here — this service only authenticates identity).
@Injectable()
export class AppleOAuthService {
  private readonly logger = new Logger(AppleOAuthService.name);
  private readonly jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  private readonly audiences: string[];

  constructor(config: ConfigService) {
    const mobileClientId = config.get<string>('APPLE_OAUTH_CLIENT_ID', '');
    const webClientId = config.get<string>('APPLE_OAUTH_WEB_CLIENT_ID', '');
    this.audiences = [mobileClientId, webClientId].filter(Boolean);
  }

  async verify(idToken: string): Promise<VerifiedOAuthIdentity> {
    if (this.audiences.length === 0) {
      throw new UnauthorizedException(
        'Apple OAuth chưa được cấu hình trên máy chủ',
      );
    }
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.audiences,
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
    } catch (error) {
      // Same reasoning as GoogleOAuthService's catch block — keep the
      // client-facing message generic, but log the real cause (wrong/missing
      // APPLE_OAUTH_WEB_CLIENT_ID, unverified domain, expired token, ...).
      this.logger.warn(
        `Apple ID token rejected (configured audiences: [${this.audiences.map((a) => a.slice(0, 12) + '…').join(', ') || 'none'}]): ${error instanceof Error ? error.message : error}`,
      );
      throw new UnauthorizedException(
        'Apple ID token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
