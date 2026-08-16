import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { SocialLoginButtons } from '../../components/SocialLoginButtons';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen({ navigation }: Props) {
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const canSubmit = isValidEmail(email) && password.length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await authApi.login({ email: email.trim(), password });
      // Storing the session flips authStore.isAuthenticated, which is all
      // RootNavigator needs to swap from the Auth stack into Main (task 7) —
      // no imperative cross-stack navigation call needed here.
      await setSession(response.user, response.accessToken, response.refreshToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Never distinguish "no such user" vs "wrong password" per the API
        // contract — always show the same generic message.
        setErrorMessage(t('auth.genericLoginError'));
      } else {
        setErrorMessage(t('auth.networkError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>

        {errorMessage ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>{t('auth.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="ban@example.com"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('auth.email')}
        />

        <Text style={styles.label}>{t('auth.password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('auth.password')}
        />

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>{t('auth.loginTitle')}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.linkRow}>
          <Text style={styles.link}>{t('auth.forgotPasswordLink')}</Text>
        </Pressable>

        <SocialLoginButtons
          onSuccess={(response) => setSession(response.user, response.accessToken, response.refreshToken)}
          onError={setErrorMessage}
        />

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
          <Text style={styles.link}>{t('auth.noAccountLink')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.background },
    title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center', color: colors.textPrimary },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: colors.textPrimary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
    linkRow: { marginTop: 16, alignItems: 'center' },
    link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    errorBanner: {
      backgroundColor: colors.errorBg,
      borderColor: colors.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { color: colors.error, fontSize: 14 },
  });
