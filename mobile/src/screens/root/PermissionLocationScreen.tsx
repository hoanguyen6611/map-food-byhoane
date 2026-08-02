import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

interface Props {
  /**
   * Called once permission has been resolved (granted OR denied) — per
   * docs/04-screen-list.md #3, denial just means reduced map accuracy
   * later (Module 3's concern), it never blocks entry into the app.
   */
  onDone: () => void;
}

/**
 * Screen 3 (Permission Location) per docs/04-screen-list.md. Rendered by
 * RootNavigator once per app session before the Auth/Main split (see
 * RootNavigator.tsx) — this module only needs the permission *request* to
 * be real; no map behavior consumes the result yet (that's Module 3).
 */
export function PermissionLocationScreen({ onDone }: Props) {
  const [isRequesting, setIsRequesting] = useState(false);

  async function handleAllow() {
    setIsRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setIsRequesting(false);
      onDone();
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bật vị trí của bạn</Text>
      <Text style={styles.body}>
        Cho phép truy cập vị trí để tìm quán ăn gần bạn nhanh hơn. Bạn vẫn có thể dùng ứng dụng
        nếu bỏ qua bước này.
      </Text>

      <Pressable
        style={[styles.primaryButton, isRequesting && styles.buttonDisabled]}
        onPress={handleAllow}
        disabled={isRequesting}
      >
        {isRequesting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Cho phép vị trí</Text>
        )}
      </Pressable>

      <Pressable style={styles.skipButton} onPress={onDone} disabled={isRequesting}>
        <Text style={styles.skipButtonText}>Để sau</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 32 },
  primaryButton: {
    backgroundColor: '#e4572e',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipButton: { paddingVertical: 8 },
  skipButtonText: { color: '#888', fontSize: 14 },
});
