import { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setHasOnboarded } from '../../lib/onboarding';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

interface Props {
  /** Called once the flag is set (skip or finishing the last slide) — see RootNavigator.tsx's doc comment on the "swap rendered branch" pattern. */
  onDone: () => void;
}

// "Giới thiệu giá trị cốt lõi (bản đồ ẩm thực, review có cấu trúc, AI gợi ý)
// trong tối đa 3 slide" — docs/04-screen-list.md #2. Emoji stand in for real
// illustration assets (none exist in this MVP), same honest-placeholder
// spirit as RestaurantCard's thumbnail fallback. Title/body come from i18n
// (root.onboardingSlideN*); only the emoji + translation-key pair live here.
const SLIDES = [
  { emoji: '🗺️', titleKey: 'root.onboardingSlide1Title', bodyKey: 'root.onboardingSlide1Body' },
  { emoji: '📝', titleKey: 'root.onboardingSlide2Title', bodyKey: 'root.onboardingSlide2Body' },
  { emoji: '✨', titleKey: 'root.onboardingSlide3Title', bodyKey: 'root.onboardingSlide3Body' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Screen 2 (Onboarding) per docs/04-screen-list.md. Rendered by
 * RootNavigator once per device (gated on the local `has_onboarded` flag,
 * see src/lib/onboarding.ts) before Permission Location — same
 * conditional-branch-swap pattern as PermissionLocationScreen, not
 * imperative navigation.
 */
export function OnboardingScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLastSlide = index === SLIDES.length - 1;

  async function finish() {
    await setHasOnboarded();
    onDone();
  }

  function goToSlide(nextIndex: number) {
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setIndex(nextIndex);
  }

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(nextIndex);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.skipButton} onPress={finish} accessibilityRole="button">
        <Text style={styles.skipText}>{t('root.onboardingSkip')}</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) => (
          <View key={slide.titleKey} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
            <Text style={styles.title}>{t(slide.titleKey)}</Text>
            <Text style={styles.body}>{t(slide.bodyKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((slide, dotIndex) => (
          <View key={slide.titleKey} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={() => (isLastSlide ? finish() : goToSlide(index + 1))}>
        <Text style={styles.primaryButtonText}>{isLastSlide ? t('root.onboardingStart') : t('root.onboardingNext')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    skipButton: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 16 },
    skipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    scrollView: { flex: 1 },
    slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emoji: { fontSize: 72, marginBottom: 24 },
    title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
    body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20 },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      marginHorizontal: 24,
      marginBottom: 32,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  });
