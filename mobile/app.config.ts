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
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'The Food Map of Vietnam uses your location to show nearby restaurants on the map.',
    },
  },
  android: {
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
  plugins: ['expo-secure-store'],
  extra: {
    ...config.extra,
    apiBaseUrl: API_BASE_URL,
  },
});
