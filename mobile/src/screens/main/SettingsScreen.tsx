import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../api/auth';
import { secureStorage } from '../../lib/secureStorage';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors, type ThemePreference } from '../../theme/ThemeContext';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

/**
 * Settings screen per build-prompts/08. Reachable only from ProfileScreen's
 * menu (post-login) — no AuthGateModal guard needed (see the module's
 * architecture note: MainStack, where this screen lives, is only ever
 * mounted when `isAuthenticated`).
 *
 * Dark mode: a 3-way System/Light/Dark selector (rather than a plain on/off
 * switch) so "follow the OS" stays an explicit, revisitable choice instead
 * of being indistinguishable from "I picked Light because that's what my
 * phone happens to be in right now". Wired straight to `useTheme()`
 * (src/theme/ThemeContext.tsx), which persists the choice to AsyncStorage.
 *
 * Account deletion: destructive + irreversible, so it requires TWO explicit
 * confirmations before calling `authApi.deleteAccount()` — (1) a native
 * `Alert.alert` confirm, then (2) a second on-screen "Xoá tài khoản" button
 * that only appears after step 1, itself requiring one more tap. On success,
 * clears the local session the same way ProfileScreen's `handleLogout` does
 * (`useAuthStore.getState().clearSession()`), which flips
 * `isAuthenticated` and lets RootNavigator fall back to the Auth stack.
 */
export function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = createStyles(colors);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) {
        await authApi.logout({ refreshToken }).catch(() => undefined);
      }
    } finally {
      await useAuthStore.getState().clearSession();
      setIsLoggingOut(false);
    }
  }

  function handleDeletePress() {
    if (!deleteArmed) {
      // Step 1: native confirm dialog.
      Alert.alert(
        'Xoá tài khoản?',
        'Hành động này không thể hoàn tác. Toàn bộ dữ liệu tài khoản của bạn sẽ bị xoá vĩnh viễn.',
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Tiếp tục', style: 'destructive', onPress: () => setDeleteArmed(true) },
        ],
      );
      return;
    }
    // Step 2: the second, explicit on-screen button — already armed, so this
    // tap performs the actual deletion.
    void performDelete();
  }

  async function performDelete() {
    setIsDeleting(true);
    try {
      await authApi.deleteAccount();
      // Mirrors ProfileScreen's logout idiom: clearing the store flips
      // `isAuthenticated`, which is all RootNavigator needs to fall back to
      // the Auth stack — no imperative navigation call needed.
      await useAuthStore.getState().clearSession();
    } catch (error) {
      setDeleteArmed(false);
      const message = error instanceof ApiError ? error.message : 'Lỗi mạng, vui lòng thử lại.';
      Alert.alert('Không thể xoá tài khoản', message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Giao diện</Text>
      <View style={styles.segmentRow}>
        {THEME_OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setPreference(option.value)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Tài khoản</Text>
      <Pressable style={styles.menuItem} onPress={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={[styles.menuItemText, styles.logoutText]}>Đăng xuất</Text>
        )}
      </Pressable>

      <View style={styles.dangerZone}>
        <View style={styles.dangerHeaderRow}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
          <Text style={styles.dangerTitle}>Xoá tài khoản</Text>
        </View>
        <Text style={styles.dangerBody}>
          Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu liên quan (đánh giá, yêu thích, đóng góp). Không thể hoàn tác.
        </Text>
        <Pressable
          style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
          onPress={handleDeletePress}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.deleteButtonText}>
              {deleteArmed ? 'Xác nhận xoá tài khoản' : 'Xoá tài khoản'}
            </Text>
          )}
        </Pressable>
        {deleteArmed && !isDeleting ? (
          <Pressable style={styles.cancelDeleteButton} onPress={() => setDeleteArmed(false)}>
            <Text style={styles.cancelDeleteButtonText}>Huỷ</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    sectionTitleSpaced: { marginTop: 32 },
    segmentRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 4 },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentSelected: {
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 1,
    },
    segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    segmentTextSelected: { color: colors.primary },
    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    menuItemText: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
    logoutText: { color: colors.error, fontWeight: '700' },
    dangerZone: {
      marginTop: 32,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      backgroundColor: colors.errorBg,
    },
    dangerHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    dangerTitle: { fontSize: 14, fontWeight: '700', color: colors.error },
    dangerBody: { fontSize: 12, color: colors.error, marginBottom: 14, lineHeight: 17 },
    deleteButton: { backgroundColor: colors.error, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    deleteButtonDisabled: { opacity: 0.6 },
    deleteButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    cancelDeleteButton: { alignItems: 'center', paddingVertical: 10 },
    cancelDeleteButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  });
