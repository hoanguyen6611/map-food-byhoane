import { IsString } from 'class-validator';

export class OAuthLoginDto {
  // Provider-issued ID token from native Google/Apple sign-in on the client —
  // verified server-side against the provider's public keys, never trusted
  // as-is (see google-oauth.service.ts / apple-oauth.service.ts).
  @IsString()
  idToken!: string;
}
