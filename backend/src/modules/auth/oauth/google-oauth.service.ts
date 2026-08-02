import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedOAuthIdentity {
  subjectId: string;
  email: string;
}

// Verifies a Google ID token issued to the mobile client by native Google
// Sign-In — never trust a client-asserted email/subject without this check.
@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<VerifiedOAuthIdentity> {
    if (!this.clientId) {
      throw new UnauthorizedException(
        'Google OAuth chưa được cấu hình trên máy chủ',
      );
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
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
