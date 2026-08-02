import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';

/**
 * Factory for trivial placeholder screens: a centered `<Text>` naming the
 * screen. Module 1 scope is the navigation graph only — real screen UI
 * arrives in later build-prompt modules (see docs/build-prompts).
 */
export function createPlaceholderScreen(title: string) {
  function PlaceholderScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{title}</Text>
      </View>
    );
  }
  PlaceholderScreen.displayName = `Placeholder(${title})`;
  return PlaceholderScreen;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    text: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
