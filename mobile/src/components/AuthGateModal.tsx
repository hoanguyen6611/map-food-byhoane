import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';

interface AuthGateModalProps {
  visible: boolean;
  /** Optional context-specific copy, e.g. "Đăng nhập để lưu vào Yêu thích". */
  message?: string;
  onDismiss: () => void;
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

/**
 * Guest -> authenticated soft auth-gate modal, per
 * docs/03-sitemap-userflow.md §2.2: "browsing never requires login; any
 * write action does." Shown when a guest attempts a gated write action.
 *
 * Nothing calls this yet in Module 2 — it's scaffolding for later modules.
 * Favorite, Write Review, and Add Restaurant (Modules 3/4/6) should render
 * this with `visible` toggled true on a guest tapping the gated action, and
 * on `onLoginPress`/`onRegisterPress` navigate into the Auth stack. To
 * satisfy the flow's "action resumes after login" step, the caller should
 * stash the pending action (e.g. in a ref or a small store) and re-run it
 * once `authStore.isAuthenticated` becomes true, then dismiss this modal.
 *
 * Deliberately simple/unstyled beyond basics — this is scaffolding, not a
 * polished component; later modules may want a bottom-sheet instead of a
 * centered modal, richer copy per action, etc.
 */
export function AuthGateModal({
  visible,
  message,
  onDismiss,
  onLoginPress,
  onRegisterPress,
}: AuthGateModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Swallow taps inside the sheet so they don't bubble to the backdrop's dismiss handler. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Cần đăng nhập</Text>
          <Text style={styles.message}>
            {message ?? 'Bạn cần đăng nhập để thực hiện hành động này.'}
          </Text>

          <Pressable style={styles.primaryButton} onPress={onLoginPress}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={onRegisterPress}>
            <Text style={styles.secondaryButtonText}>Đăng ký</Text>
          </Pressable>

          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Để sau</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlayScrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 24,
    },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: colors.textPrimary },
    message: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, textAlign: 'center' },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
    dismissButton: { alignItems: 'center', paddingVertical: 8 },
    dismissText: { color: colors.textSecondary, fontSize: 14 },
  });
