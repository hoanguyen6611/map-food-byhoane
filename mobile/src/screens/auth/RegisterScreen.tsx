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
import type { AuthStackParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

// TODO(later module): Google / Apple native sign-in buttons — see the same
// TODO in LoginScreen.tsx for rationale.

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Per docs/04-screen-list.md #5: password ≥8 chars, at least one digit. */
function isValidPassword(value: string): boolean {
  return value.length >= 8 && /\d/.test(value);
}

export function RegisterScreen({ navigation }: Props) {
  const setSession = useAuthStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit =
    isValidEmail(email) &&
    isValidPassword(password) &&
    passwordsMatch &&
    agreedToTerms &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await authApi.register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      // Register auto-logs-in per docs/04-screen-list.md #5: storing the
      // session flips authStore.isAuthenticated, which is what moves
      // RootNavigator from Auth into Main (see task 7).
      await setSession(response.user, response.accessToken, response.refreshToken);
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
        <Text style={styles.title}>Đăng ký</Text>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Tên hiển thị (tuỳ chọn)</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Nguyễn Văn A"
          placeholderTextColor={colors.textTertiary}
        />

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

        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="Tối thiểu 8 ký tự, có số"
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={styles.label}>Xác nhận mật khẩu</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Nhập lại mật khẩu"
          placeholderTextColor={colors.textTertiary}
        />
        {confirmPassword.length > 0 && !passwordsMatch ? (
          <Text style={styles.fieldError}>Mật khẩu xác nhận không khớp.</Text>
        ) : null}

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAgreedToTerms((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToTerms }}
        >
          <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
            {agreedToTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Đăng ký</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
          <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
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
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    fieldError: { color: colors.error, fontSize: 13, marginTop: -12, marginBottom: 12 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkboxMark: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
    checkboxLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },
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
  });
