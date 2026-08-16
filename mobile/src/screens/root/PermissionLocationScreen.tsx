import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

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
      <Text style={styles.title}>{t('root.permissionTitle')}</Text>
      <Text style={styles.body}>{t('root.permissionBody')}</Text>

      <Pressable
        style={[styles.primaryButton, isRequesting && styles.buttonDisabled]}
        onPress={handleAllow}
        disabled={isRequesting}
      >
        {isRequesting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('root.permissionAllow')}</Text>
        )}
      </Pressable>

      <Pressable style={styles.skipButton} onPress={onDone} disabled={isRequesting}>
        <Text style={styles.skipButtonText}>{t('root.permissionSkip')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: colors.background,
    },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: colors.textPrimary },
    body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 32,
      alignItems: 'center',
      width: '100%',
      marginBottom: 16,
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
    skipButton: { paddingVertical: 8 },
    skipButtonText: { color: colors.textTertiary, fontSize: 14 },
  });
