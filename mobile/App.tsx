import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Single app-wide QueryClient. Module 1 scope: just wire the provider up;
// real query/mutation usage starts alongside real API endpoints in later
// modules (see src/api/client.ts, src/api/useHealth.ts for the scaffolding).
const queryClient = new QueryClient();

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

  return (
    <>
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
