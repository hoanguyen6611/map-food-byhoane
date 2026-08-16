import { IsString } from 'class-validator';

export class OAuthLoginDto {
  // Provider-issued credential from native Google/Apple/Facebook sign-in on
  // the client — verified server-side, never trusted as-is (see
  // google-oauth.service.ts / apple-oauth.service.ts / facebook-oauth.service.ts).
  // For Google/Apple this is a JWT ID token; for Facebook it's an access
  // token (that provider's SDK doesn't hand the client a JWT) — same field
  // name on the wire either way to keep the three endpoints symmetric.
  @IsString()
  idToken!: string;
}
