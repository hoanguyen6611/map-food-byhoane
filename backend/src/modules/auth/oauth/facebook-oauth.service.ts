import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedOAuthIdentity } from './google-oauth.service';

const GRAPH_API_BASE = 'https://graph.facebook.com';

interface DebugTokenResponse {
  data?: { app_id?: string; is_valid?: boolean };
}

interface MeResponse {
  id?: string;
  email?: string;
}

// Verifies a Facebook access token issued to the mobile client by the native
// Facebook Login SDK — never trust a client-asserted email/subject without
// this check. Unlike Google/Apple (which hand the client a JWT verifiable
// against the provider's public keys), Facebook's SDK yields a plain access
// token, so verification is two Graph API calls instead of local JWT
// validation: `debug_token` confirms the token was minted for *our* app
// (Facebook's equivalent of an audience check), then `/me` fetches the
// subject id + email.
@Injectable()
export class FacebookOAuthService {
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('FACEBOOK_APP_ID', '');
    this.appSecret = config.get<string>('FACEBOOK_APP_SECRET', '');
  }

  async verify(accessToken: string): Promise<VerifiedOAuthIdentity> {
    if (!this.appId || !this.appSecret) {
      throw new UnauthorizedException(
        'Facebook OAuth chưa được cấu hình trên máy chủ',
      );
    }
    try {
      const appAccessToken = `${this.appId}|${this.appSecret}`;
      const debugUrl = `${GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
      const debugResponse = await fetch(debugUrl);
      const debugBody = (await debugResponse.json()) as DebugTokenResponse;
      if (
        !debugResponse.ok ||
        !debugBody.data?.is_valid ||
        debugBody.data.app_id !== this.appId
      ) {
        throw new UnauthorizedException('Facebook access token không hợp lệ');
      }

      const meUrl = `${GRAPH_API_BASE}/me?fields=id,email&access_token=${encodeURIComponent(accessToken)}`;
      const meResponse = await fetch(meUrl);
      const me = (await meResponse.json()) as MeResponse;
      if (!meResponse.ok || !me.id || !me.email) {
        throw new UnauthorizedException('Facebook access token không hợp lệ');
      }

      return { subjectId: me.id, email: me.email.toLowerCase() };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Facebook access token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
