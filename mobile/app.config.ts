import type { ExpoConfig, ConfigContext } from 'expo/config';

// --- API base URL wiring ---------------------------------------------------
// Chosen approach (see mobile section of docs/build-prompts/01-foundations.md
// §5): app.config.ts (a Node.js module, not bundled into the app) + Expo
// Constants' `extra` field, rather than `react-native-dotenv`.
//
// Expo CLI already auto-loads `.env` / `.env.local` files (SDK 49+) into
// `process.env` before this file is evaluated, so copying `.env.example` to
// `.env` and setting API_BASE_URL there is enough to override the default
// below for local development — no extra babel/metro plugin needed.
//
// We deliberately do NOT rely on the `EXPO_PUBLIC_` env var convention
// (which inlines vars directly into client JS) so that the same value is
// also easily readable from plain Node scripts/tooling later if needed;
// instead we thread it through `extra`, which `expo-constants` exposes at
// runtime on-device. See src/api/client.ts for the read side.
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

// --- Social login config ----------------------------------------------------
// Same `process.env` + `extra` idiom as API_BASE_URL above — real values come
// from each provider's developer console (Google Cloud Console / Meta for
// Developers) and are set in `mobile/.env`, not committed here. Until then
// these are empty strings: the native SDKs install/build fine, but each
// provider will reject sign-in until a real app is registered.
const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID ?? '';
// Google's iOS config plugin wants the CLIENT ID'S OWN reversed form as the
// URL scheme (e.g. client id `123-abc.apps.googleusercontent.com` ->
// `com.googleusercontent.apps.123-abc`). Derived here automatically rather
// than read from a separate hand-typed env var — a truncated/mistyped value
// here silently breaks Google sign-in with no helpful error message (this
// happened twice with a manually-maintained GOOGLE_IOS_URL_SCHEME env var,
// so that variable is no longer read at all).
const GOOGLE_IOS_URL_SCHEME = GOOGLE_IOS_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID ?? '';
const FACEBOOK_CLIENT_TOKEN = process.env.FACEBOOK_CLIENT_TOKEN ?? '';
// Facebook's iOS SDK needs a `fb<APP_ID>` URL scheme for the login redirect —
// derived from the app id rather than a separate env var, since it's always
// that exact shape.
const FACEBOOK_SCHEME = FACEBOOK_APP_ID ? `fb${FACEBOOK_APP_ID}` : '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'mobile',
  slug: 'mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // 'automatic' so native chrome (keyboard appearance, etc.) follows the OS
  // scheme too — the in-app ThemeProvider (src/theme/ThemeContext.tsx) is
  // the source of truth for the app's OWN UI and can diverge from this via
  // an explicit user override, but native OS-level surfaces only ever
  // follow the system setting regardless.
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    // Placeholder reverse-DNS identifier — required by EAS for any build,
    // dev or production. Fine to keep as-is unless/until this is actually
    // submitted to the App Store, at which point it just needs to be unique
    // to your Apple Developer account.
    bundleIdentifier: 'com.foodmapvietnam.mobile',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'The Food Map of Vietnam uses your location to show nearby restaurants on the map.',
    },
    // Required by Apple to even show a "Sign in with Apple" button —
    // injects the `com.apple.developer.applesignin` entitlement on prebuild.
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.foodmapvietnam.mobile',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  // expo-secure-store needs no native config beyond the plugin being present
  // (Keychain on iOS / EncryptedSharedPreferences-backed Keystore on Android
  // are used automatically); expo-location needs no plugin config for the
  // foreground-only permission request used by PermissionLocationScreen.
  //
  // Both the google-signin and fbsdk-next config plugins hard-fail prebuild
  // if their required id/scheme is empty — unlike other providers in this
  // file, they don't tolerate an empty-string placeholder — so each is only
  // included once its real value exists. Until then, signing in with that
  // provider fails at runtime with a clear SDK error rather than breaking
  // the whole native build; the native module itself is still linked via
  // autolinking regardless (see mobile/env.example for what to fill in).
  plugins: [
    'expo-secure-store',
    'expo-localization',
    'expo-apple-authentication',
    'expo-notifications',
    ...(GOOGLE_IOS_URL_SCHEME
      ? ([['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }]] as [
          string,
          Record<string, unknown>,
        ][])
      : []),
    ...(FACEBOOK_APP_ID
      ? ([
          [
            'react-native-fbsdk-next',
            {
              appID: FACEBOOK_APP_ID,
              clientToken: FACEBOOK_CLIENT_TOKEN,
              displayName: 'The Food Map of Vietnam',
              scheme: FACEBOOK_SCHEME,
              isAutoInitEnabled: true,
            },
          ],
        ] as [string, Record<string, unknown>][])
      : []),
  ],
  extra: {
    ...config.extra,
    apiBaseUrl: API_BASE_URL,
    googleIosClientId: GOOGLE_IOS_CLIENT_ID,
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    facebookAppId: FACEBOOK_APP_ID,
    // EAS can't write this into a dynamic (.ts) config automatically the way
    // it does for app.json, so it's pinned here by hand — links this project
    // to the EAS project created on first `eas build`.
    eas: {
      projectId: '9d1fee04-36ae-49cb-9f38-7040633a326a',
    },
  },
});
