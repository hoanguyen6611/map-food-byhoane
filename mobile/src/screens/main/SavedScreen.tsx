import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FavoriteListResponse } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { RestaurantCard } from '../../components/RestaurantCard';
import { useFavoritesList, useToggleFavorite } from '../../hooks/useFavorites';
import { getVisitedRestaurantIds, setVisited } from '../../lib/savedVisitTags';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../navigation/tabConfig';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Saved'>,
  NativeStackScreenProps<MainStackParamList>
>;

// A single large page rather than FavoritesScreen's original manual pager —
// this screen splits favorites into "Muốn thử"/"Đã đi" by a LOCAL-only tag
// (see savedVisitTags.ts; `Favorite` has no such field server-side), which
// only works cleanly against one already-fetched set, not a page at a time.
// 50 is the backend's own max pageSize (FavoriteListQueryDto) — most users
// won't have more saved restaurants than that; if they do, older ones past
// this cap won't appear here, an honest tradeoff for the local-tag split.
const PAGE_SIZE = 50;

type SavedTab = 'wantToTry' | 'visited' | 'lists';

/**
 * "Ngon v3" Saved tab (renamed from Favorites — build-prompts/08 scope,
 * restyled + 3-tab split added). Auth is guaranteed here — the Saved tab
 * only exists inside MainStack, which RootNavigator only mounts when
 * `isAuthenticated` — no AuthGateModal guard needed.
 *
 * "Muốn thử"/"Đã đi" is a REAL favorite list, split by a LOCAL-only visited
 * flag (see savedVisitTags.ts) — no backend field for this exists.
 * "Danh sách" (custom named lists) has no backend concept at all; it's a
 * static "coming soon" placeholder, not fake CRUD.
 */
export function SavedScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SavedTab>('wantToTry');
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const favoritesQuery = useFavoritesList(1, PAGE_SIZE);
  const toggleFavorite = useToggleFavorite();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    getVisitedRestaurantIds().then(setVisitedIds);
  }, []);

  async function handleToggleVisited(restaurantId: string, visited: boolean) {
    await setVisited(restaurantId, visited);
    setVisitedIds((prev) => {
      const next = new Set(prev);
      if (visited) {
        next.add(restaurantId);
      } else {
        next.delete(restaurantId);
      }
      return next;
    });
  }

  const allItems = favoritesQuery.data?.items ?? [];
  const wantToTryItems = allItems.filter((item) => !visitedIds.has(item.restaurantId));
  const visitedItems = allItems.filter((item) => visitedIds.has(item.restaurantId));
  const items = tab === 'wantToTry' ? wantToTryItems : tab === 'visited' ? visitedItems : [];

  const showInitialLoading = favoritesQuery.isLoading;
  const showEmpty = tab !== 'lists' && favoritesQuery.isSuccess && items.length === 0;

  function handleUnfavorite(restaurantId: string) {
    toggleFavorite.mutate({ restaurantId, isFavorited: true });
    queryClient.setQueryData<FavoriteListResponse>(['favorites', 1, PAGE_SIZE], (old) =>
      old
        ? {
            ...old,
            items: old.items.filter((item) => item.restaurantId !== restaurantId),
            total: Math.max(0, old.total - 1),
          }
        : old,
    );
  }

  const tabs: { key: SavedTab; label: string; count: number }[] = [
    { key: 'wantToTry', label: t('saved.tabWantToTry'), count: wantToTryItems.length },
    { key: 'visited', label: t('saved.tabVisited'), count: visitedItems.length },
    { key: 'lists', label: t('saved.tabLists'), count: 0 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{t('nav.tabSaved')}</Text>
        <View style={styles.tabRow}>
          {tabs.map((tabDef) => {
            const selected = tab === tabDef.key;
            return (
              <Pressable
                key={tabDef.key}
                style={[styles.tabChip, selected && styles.tabChipSelected]}
                onPress={() => setTab(tabDef.key)}
              >
                <Text style={[styles.tabChipText, selected && styles.tabChipTextSelected]}>{tabDef.label}</Text>
                <View style={[styles.tabPill, selected && styles.tabPillSelected]}>
                  <Text style={[styles.tabPillText, selected && styles.tabPillTextSelected]}>{tabDef.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {showInitialLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : favoritesQuery.isError ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
          <Text style={styles.errorBody}>{t('saved.errorBody')}</Text>
          <Pressable style={styles.retryButton} onPress={() => favoritesQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : tab === 'lists' ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.emptyText}>{t('saved.listsComingSoon')}</Text>
        </View>
      ) : showEmpty ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.emptyText}>{t('saved.emptyText')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View>
              <RestaurantCard
                restaurant={item.restaurant}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.restaurantId })}
                isFavorited
                onToggleFavorite={() => handleUnfavorite(item.restaurantId)}
              />
              <Pressable
                style={styles.visitToggle}
                onPress={() => handleToggleVisited(item.restaurantId, tab !== 'visited')}
              >
                <Text style={styles.visitToggleText}>
                  {tab === 'visited' ? t('saved.markWantToTry') : t('saved.markVisited')}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBlock: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
    title: { fontSize: 24, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    tabRow: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabChip: {
      flex: 1,
      height: 36,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    tabChipSelected: { backgroundColor: colors.primary },
    tabChipText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyMedium, color: colors.textSecondary },
    tabChipTextSelected: { color: colors.onPrimary },
    tabPill: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabPillSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
    tabPillText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold, color: colors.textTertiary },
    tabPillTextSelected: { color: colors.onPrimary },
    listContent: { padding: 16, paddingBottom: 16 + FLOATING_TAB_BAR_CLEARANCE },
    visitToggle: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 10, paddingHorizontal: 4 },
    visitToggleText: { fontSize: 12, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.link },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
    },
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontFamily: FONT_FAMILY.bodySemiBold, textAlign: 'center' },
  });
