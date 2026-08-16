import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Result of a social sign-in attempt on the client, before it's sent to the
 * backend's `POST /auth/oauth/{provider}` (see `api/auth.ts`'s `oauthLogin`).
 * `token` is a Google/Apple ID token (JWT) for those two providers, or a
 * Facebook access token — the backend's `OAuthLoginDto.idToken` field is
 * generic over both shapes (see its doc comment).
 */
export type SocialSignInResult = { cancelled: true } | { cancelled: false; token: string };

let googleConfigured = false;

/**
 * Idempotent — safe to call on every sign-in attempt. Deliberately NOT
 * called at app startup (see App.tsx's note).
 *
 * `GoogleSignin.configure()` itself is declared `void`, not `Promise<void>`
 * — the JS wrapper doesn't await the native side, so a misconfiguration
 * there surfaces as an *unhandled* promise rejection (a RedBox) rather than
 * something a caller's try/catch can ever see. So this guards BEFORE ever
 * calling it: with no client ID configured, it throws a normal, catchable
 * error instead of invoking the native module in a broken state.
 */
export function configureGoogleSignIn(): void {
  if (googleConfigured) return;
  const extra = Constants.expoConfig?.extra ?? {};
  const iosClientId = typeof extra.googleIosClientId === 'string' ? extra.googleIosClientId : '';
  const webClientId = typeof extra.googleWebClientId === 'string' ? extra.googleWebClientId : '';
  if (!iosClientId && !webClientId) {
    throw new Error('Google Sign-In chưa được cấu hình (thiếu Client ID)');
  }
  GoogleSignin.configure({
    iosClientId: iosClientId || undefined,
    webClientId: webClientId || undefined,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  configureGoogleSignIn();
  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') {
    return { cancelled: true };
  }
  const idToken = result.data.idToken;
  if (!idToken) {
    throw new Error('Google không trả về idToken');
  }
  return { cancelled: false, token: idToken };
}

export async function signInWithFacebook(): Promise<SocialSignInResult> {
  const loginResult = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (loginResult.isCancelled) {
    return { cancelled: true };
  }
  const accessToken = await AccessToken.getCurrentAccessToken();
  if (!accessToken) {
    throw new Error('Facebook không trả về access token');
  }
  return { cancelled: false, token: accessToken.accessToken };
}

/** iOS only — callers must gate this behind `Platform.OS === 'ios'` (see `SocialLoginButtons.tsx`). */
export async function signInWithApple(): Promise<SocialSignInResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Đăng nhập bằng Apple chỉ khả dụng trên iOS');
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) {
      throw new Error('Apple không trả về identityToken');
    }
    return { cancelled: false, token: credential.identityToken };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return { cancelled: true };
    }
    throw error;
  }
}
