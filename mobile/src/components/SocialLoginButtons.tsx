import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { AuthResponse } from '@foodmap/shared-types';
import { authApi, type OAuthProvider } from '../api/auth';
import { ApiError } from '../api/client';
import { signInWithApple, signInWithFacebook, signInWithGoogle } from '../lib/socialAuth';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { FONT_FAMILY } from '../theme/fonts';

interface Props {
  onSuccess: (response: AuthResponse) => void;
  onError: (message: string) => void;
}

const PROVIDERS: { provider: OAuthProvider; icon: keyof typeof Ionicons.glyphMap; labelKey: string; iosOnly?: boolean }[] = [
  { provider: 'google', icon: 'logo-google', labelKey: 'auth.continueWithGoogle' },
  { provider: 'facebook', icon: 'logo-facebook', labelKey: 'auth.continueWithFacebook' },
  { provider: 'apple', icon: 'logo-apple', labelKey: 'auth.continueWithApple', iosOnly: true },
];

/**
 * "Continue with Google / Facebook / Apple" buttons, shared by LoginScreen
 * and RegisterScreen — `authService.oauthLogin` (backend) auto-creates an
 * account if none exists yet, so both screens use this exact same component
 * and handler. Apple is gated to iOS per docs/04-screen-list.md's "nút Apple
 * (iOS)" — Google/Facebook render on both platforms.
 */
export function SocialLoginButtons({ onSuccess, onError }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  async function handlePress(provider: OAuthProvider) {
    if (loadingProvider) return;
    setLoadingProvider(provider);
    try {
      const result =
        provider === 'google'
          ? await signInWithGoogle()
          : provider === 'facebook'
            ? await signInWithFacebook()
            : await signInWithApple();

      // Cancelled by the user — return to the form unchanged, no error shown
      // (docs/01-prd-mvp.md's exception flow: "OAuth cancelled -> return to
      // login unchanged").
      if (result.cancelled) return;

      const response = await authApi.oauthLogin(provider, { idToken: result.token });
      onSuccess(response);
    } catch (error) {
      onError(error instanceof ApiError ? error.message : t('auth.socialLoginError'));
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttonRow}>
        {PROVIDERS.filter((p) => !p.iosOnly || Platform.OS === 'ios').map(({ provider, icon, labelKey }) => (
          <Pressable
            key={provider}
            style={styles.button}
            onPress={() => handlePress(provider)}
            disabled={loadingProvider !== null}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
          >
            {loadingProvider === provider ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Ionicons name={icon} size={22} color={colors.textPrimary} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
    dividerText: { fontSize: 12, color: colors.textTertiary, fontFamily: FONT_FAMILY.meta, textTransform: 'uppercase' },
    buttonRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
    button: {
      width: 52,
      height: 52,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
