import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

/**
 * Screen 1 (Splash) per docs/04-screen-list.md. Boots the app: hydrates the
 * auth store from secure storage (task 2) so RootNavigator knows whether to
 * conditionally render the Main stack or the pre-auth flow (see
 * RootNavigator.tsx) — flipping `isHydrated`/`isAuthenticated` is enough to
 * move the app forward; no imperative navigation call is made here (per
 * task 7's conditional-rendering pattern).
 *
 * Per the screen spec, a network error while checking the session should
 * never block entry into the app; hydration here only reads local secure
 * storage (no network call), so it can't fail on network. If a stored
 * access token has actually expired, that's caught lazily by the API
 * client's 401-refresh interceptor on the first authenticated request
 * (e.g. Profile's `GET /me`), which clears the session and falls back to
 * the Auth stack at that point.
 */
export function SplashScreen() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Food Map of Vietnam</Text>
      <ActivityIndicator style={styles.spinner} color={colors.primary} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: colors.textPrimary },
    spinner: { marginTop: 8 },
  });
