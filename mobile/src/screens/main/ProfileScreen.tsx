import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { secureStorage } from '../../lib/secureStorage';
import { useAuthStore } from '../../store/authStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<MainStackParamList>
>;

/**
 * Screen 23 (User Profile) per docs/04-screen-list.md. Module 2 scope is the
 * account-management essentials (display identity, Edit Profile, Logout) so
 * the Definition of Done's Register -> ... -> Logout -> Login flow works
 * end-to-end. Favorites/Notifications/Settings menu links are intentionally
 * left out — those screens are still placeholders owned by later modules.
 */
export function ProfileScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: authApi.me });

  const displayName = meQuery.data?.profile.displayName ?? '';
  const email = meQuery.data?.user.email ?? user?.email ?? '';

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) {
        // Best-effort: even if this fails (e.g. offline, already-invalid
        // token), we still clear the local session below so the user isn't
        // stuck logged in on-device.
        await authApi.logout({ refreshToken }).catch(() => undefined);
      }
    } finally {
      // Clearing the store flips isAuthenticated to false, which is what
      // RootNavigator uses to fall back to the Auth stack (task 7) — no
      // imperative navigation call needed.
      await clearSession();
      setIsLoggingOut(false);
    }
  }

  return (
    <View style={styles.container}>
      {meQuery.isLoading ? (
        <ActivityIndicator style={styles.headerSpinner} />
      ) : (
        <View style={styles.header}>
          <Text style={styles.displayName}>{displayName || 'Cá nhân'}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      )}

      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
        <Text style={styles.menuItemText}>Chỉnh sửa hồ sơ</Text>
      </Pressable>

      <Pressable
        style={[styles.menuItem, styles.logoutItem]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator color="#a94442" />
        ) : (
          <Text style={[styles.menuItemText, styles.logoutText]}>Đăng xuất</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 24 },
  headerSpinner: { marginVertical: 32 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  displayName: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  logoutItem: { marginTop: 24, borderTopColor: '#eee' },
  logoutText: { color: '#a94442', fontWeight: '700' },
});
