import { useEffect, useRef, useState } from 'react';
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
import type { AuthStackParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const RESEND_COOLDOWN_SECONDS = 60;

// Response is identical whether or not the account exists — per the API
// contract there is nothing to branch on client-side, so we always show
// this same message on success.
const SUCCESS_MESSAGE = 'Nếu tài khoản tồn tại, chúng tôi đã gửi email hướng dẫn đặt lại mật khẩu.';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  function startCooldown() {
    setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const canSubmit = isValidEmail(email) && !isSubmitting && cooldownSeconds === 0;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSuccessMessage(SUCCESS_MESSAGE);
      startCooldown();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Lỗi mạng, vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Quên mật khẩu</Text>
        <Text style={styles.subtitle}>
          Nhập email của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu nếu tài khoản tồn tại.
        </Text>

        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
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
        />

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>
              {cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds}s` : 'Gửi liên kết'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
          <Text style={styles.link}>Quay lại đăng nhập</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.background },
    title: { fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: colors.textPrimary },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: colors.textPrimary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
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
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { color: colors.error, fontSize: 14 },
    successBanner: {
      backgroundColor: colors.successBg,
      borderColor: colors.successBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    successText: { color: colors.success, fontSize: 14 },
  });
