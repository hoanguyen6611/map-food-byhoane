import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedOAuthIdentity {
  subjectId: string;
  email: string;
}

// Verifies a Google ID token issued to the mobile client by native Google
// Sign-In, or to the web client by Google Identity Services JS — never
// trust a client-asserted email/subject without this check. Google issues a
// distinct OAuth client id per platform ("Web application" vs
// Android/iOS), so the token's `aud` claim differs by client; `sub` (the
// account id we actually key identity on) does not, so accepting either
// audience here doesn't create a second identity per user.
@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly audiences: string[];

  constructor(config: ConfigService) {
    const mobileClientId = config.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
    const webClientId = config.get<string>('GOOGLE_OAUTH_WEB_CLIENT_ID', '');
    this.audiences = [mobileClientId, webClientId].filter(Boolean);
    this.client = new OAuth2Client();
  }

  async verify(idToken: string): Promise<VerifiedOAuthIdentity> {
    if (this.audiences.length === 0) {
      throw new UnauthorizedException(
        'Google OAuth chưa được cấu hình trên máy chủ',
      );
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Google ID token không hợp lệ');
      }
      return { subjectId: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      throw new UnauthorizedException(
        'Google ID token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
