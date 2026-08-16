import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantCategoryCode, RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRestaurantSearch } from '../../hooks/useRestaurantSearch';
import { getFilterValues, useFilterStore } from '../../store/filterStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { CATEGORY_LABELS } from '../../lib/restaurantLabels';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../navigation/tabConfig';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Explore'>,
  NativeStackScreenProps<MainStackParamList>
>;

const LEADERBOARD_SIZE = 5;

// Screen-local icon map, same "duplicate small label/icon maps per screen"
// convention as FilterScreen's FACILITY_LABEL_KEYS / AddRestaurantScreen's
// CUISINE_LABEL_KEYS, rather than a new shared module for 6 entries.
const CATEGORY_ICONS: Record<RestaurantCategoryCode, keyof typeof Ionicons.glyphMap> = {
  quan_an: 'restaurant-outline',
  quan_ca_phe: 'cafe-outline',
  nha_hang: 'wine-outline',
  xe_day: 'bicycle-outline',
  quan_via_he: 'storefront-outline',
  quan_bar: 'beer-outline',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as RestaurantCategoryCode[];

// "Xu hướng"/"Mới mở" have no distinct backend sort (see the reskin plan's
// gap list) — all 3 segments currently query the exact same real "browse
// near me" results; only the selected pill changes. Real data throughout,
// just not yet actually differentiated by segment.
const SEGMENTS = ['nearMe', 'trending', 'newlyOpened'] as const;
type Segment = (typeof SEGMENTS)[number];

/**
 * "Ngon v3" Explore tab (new — folds the old standalone Map tab in as a
 * "Mở bản đồ" entry point rather than its own tab, per the mockup's IA).
 * Category tiles and the leaderboard are both REAL data (search-by-category,
 * top-N by compositeScore) — the mockup's own coded category grid has no
 * onClick handler at all (decorative in the source mockup); this wires it
 * to the real category filter since the backend already supports it.
 */
export function ExploreScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('nearMe');
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { location } = useDeviceLocation();
  // `getFilterValues` builds a fresh object every call — must be wrapped in
  // `useShallow` or `useSyncExternalStore` sees a "new" snapshot on every
  // render (never reference-equal to the last one) and loops forever. Same
  // fix as MapScreen.tsx's identical use of this selector.
  const filterValues = useFilterStore(useShallow(getFilterValues));

  const leaderboardQuery = useRestaurantSearch({ filters: filterValues, location });
  const leaderboard: RestaurantSummaryDto[] = useMemo(() => {
    const items = leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return [...items]
      .sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
      .slice(0, LEADERBOARD_SIZE);
  }, [leaderboardQuery.data]);

  return (
    <View style={styles.container}>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t('nav.tabExplore')}</Text>
              <Pressable
                style={styles.filterPill}
                onPress={() => navigation.navigate('Filter')}
                accessibilityRole="button"
              >
                <Ionicons name="options-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.filterPillText}>{t('list.filter')}</Text>
              </Pressable>
            </View>

            <View style={styles.segmentRow}>
              {SEGMENTS.map((key) => {
                const selected = segment === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    onPress={() => setSegment(key)}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {t(`explore.segment_${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.mapTeaser} onPress={() => navigation.navigate('Map')}>
              <View style={styles.mapTeaserIcon}>
                <Ionicons name="map-outline" size={26} color={colors.link} />
              </View>
              <View style={styles.mapTeaserTextBlock}>
                <Text style={styles.mapTeaserTitle}>{t('explore.mapTeaserTitle')}</Text>
                <Text style={styles.mapTeaserSubtitle}>{t('explore.mapTeaserSubtitle')}</Text>
              </View>
              <Pressable style={styles.mapTeaserButton} onPress={() => navigation.navigate('Map')}>
                <Text style={styles.mapTeaserButtonText}>{t('explore.openMap')}</Text>
              </Pressable>
            </Pressable>

            <Text style={styles.sectionTitle}>{t('explore.categoriesHeading')}</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map((code) => (
                <Pressable
                  key={code}
                  style={styles.categoryTile}
                  onPress={() => navigation.navigate('SearchResult', { category: code })}
                >
                  <View style={styles.categoryIconWrap}>
                    <Ionicons name={CATEGORY_ICONS[code]} size={22} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.categoryLabel} numberOfLines={1}>
                    {CATEGORY_LABELS[code]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>{t('explore.leaderboardHeading')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.rankRow}
            onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
          >
            <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
              <Text style={[styles.rankBadgeText, index === 0 && styles.rankBadgeTextFirst]}>{index + 1}</Text>
            </View>
            <View style={styles.rankThumb}>
              {item.thumbnailUrl ? null : <Text style={styles.rankThumbEmoji}>🍽️</Text>}
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.rankName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            {item.compositeScore !== null ? (
              <View style={styles.rankScore}>
                <Ionicons name="star" size={12} color={colors.star} />
                <Text style={styles.rankScoreText}>{item.compositeScore.toFixed(1)}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 16 + FLOATING_TAB_BAR_CLEARANCE },
    headerBlock: { gap: 18, paddingTop: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 24, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyMedium, color: colors.textPrimary },
    segmentRow: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    segmentSelected: { backgroundColor: colors.primary },
    segmentText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyMedium, color: colors.textSecondary },
    segmentTextSelected: { color: colors.onPrimary },
    mapTeaser: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.accentCyanSurface,
      padding: 16,
      gap: 12,
    },
    mapTeaserIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapTeaserTextBlock: { gap: 2 },
    mapTeaserTitle: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    mapTeaserSubtitle: { fontSize: 12, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    mapTeaserButton: {
      alignSelf: 'flex-start',
      height: 34,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.link,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapTeaserButtonText: { color: '#ffffff', fontSize: 12, fontFamily: FONT_FAMILY.button },
    sectionTitle: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryTile: { width: '22%', alignItems: 'center', gap: 6 },
    categoryIconWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryLabel: { fontSize: 11, fontFamily: FONT_FAMILY.metaMedium, color: colors.textSecondary, textAlign: 'center' },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rankBadge: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankBadgeFirst: { backgroundColor: colors.primarySurface },
    rankBadgeText: { fontSize: 12, fontFamily: FONT_FAMILY.buttonSemiBold, color: colors.textPrimary },
    rankBadgeTextFirst: { color: colors.primary },
    rankThumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankThumbEmoji: { fontSize: 18 },
    rankInfo: { flex: 1, minWidth: 0 },
    rankName: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    rankScore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rankScoreText: { fontSize: 13, fontFamily: FONT_FAMILY.buttonSemiBold, color: colors.textPrimary },
    separator: { height: 1, backgroundColor: colors.divider },
  });
