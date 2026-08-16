import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';
import { LocaleProvider } from './src/i18n/LocaleContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import type { RootStackParamList } from './src/navigation/types';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { FONTS_TO_LOAD } from './src/theme/fonts';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Single app-wide QueryClient. Module 1 scope: just wire the provider up;
// real query/mutation usage starts alongside real API endpoints in later
// modules (see src/api/client.ts, src/api/useHealth.ts for the scaffolding).
const queryClient = new QueryClient();

// Module-scope singleton (React Navigation's documented pattern for
// navigating from outside a screen component) — usePushNotifications needs
// this to navigate on a push-notification tap, which can happen while no
// screen owns a `navigation` prop to call.
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// NOTE: `GoogleSignin.configure()` is intentionally NOT called here at
// startup — the native SDK throws synchronously if no client ID is
// configured yet (real credentials are a follow-up step, see
// mobile/env.example), which would crash the whole app on launch rather than
// just the Google sign-in button. It's called lazily inside
// `signInWithGoogle()` (src/lib/socialAuth.ts) instead, right before
// `signIn()`, where a failure is caught and surfaced as a normal error by
// `SocialLoginButtons`.

/**
 * Split out from `App` so it can call `useTheme()` (which requires being
 * mounted under `ThemeProvider`). Also feeds our color tokens into
 * `NavigationContainer`'s `theme` prop (build-prompts/08) so React
 * Navigation's own chrome — native-stack headers, the bottom tab bar, screen
 * background behind any given screen's content — follows dark mode too,
 * not just the screens' own `StyleSheet`s.
 */
function AppShell() {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
    },
  };

  usePushNotifications(navigationRef);

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(FONTS_TO_LOAD);

  // Fonts are small JS-bundled assets (no native module), so this resolves
  // almost immediately — not worth a splash screen just for this.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <LocaleProvider>
      <ThemeProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AppShell />
          </QueryClientProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
