import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FavoriteListResponse } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { RestaurantCard } from '../../components/RestaurantCard';
import { useFavoritesList, useToggleFavorite } from '../../hooks/useFavorites';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Favorites'>,
  NativeStackScreenProps<MainStackParamList>
>;

const PAGE_SIZE = 20;

/**
 * Screen (Favorites tab) per build-prompts/08. Auth is guaranteed here — the
 * Favorites tab only exists inside MainStack, which RootNavigator only mounts
 * when `isAuthenticated` (see the architecture note in the module brief) — no
 * AuthGateModal guard needed.
 *
 * Un-favoriting a row here removes it from the list immediately (optimistic):
 * `useToggleFavorite` flips the shared `['favoriteIds']` cache, and this
 * screen additionally strips the row straight out of its own
 * `['favorites', page, pageSize]` cache entry rather than waiting for a
 * refetch.
 */
export function FavoritesScreen({ navigation }: Props) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const favoritesQuery = useFavoritesList(page, PAGE_SIZE);
  const toggleFavorite = useToggleFavorite();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const items = favoritesQuery.data?.items ?? [];
  const total = favoritesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showInitialLoading = favoritesQuery.isLoading;
  const showEmpty = favoritesQuery.isSuccess && items.length === 0;

  function handleUnfavorite(restaurantId: string) {
    toggleFavorite.mutate({ restaurantId, isFavorited: true });
    queryClient.setQueryData<FavoriteListResponse>(['favorites', page, PAGE_SIZE], (old) =>
      old
        ? {
            ...old,
            items: old.items.filter((item) => item.restaurantId !== restaurantId),
            total: Math.max(0, old.total - 1),
          }
        : old,
    );
  }

  if (showInitialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (favoritesQuery.isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Không có kết nối</Text>
        <Text style={styles.errorBody}>Không thể tải danh sách yêu thích. Vui lòng thử lại.</Text>
        <Pressable style={styles.retryButton} onPress={() => favoritesQuery.refetch()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>Bạn chưa có quán yêu thích nào.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item.restaurant}
            onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.restaurantId })}
            isFavorited
            onToggleFavorite={() => handleUnfavorite(item.restaurantId)}
          />
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagerRow}>
              <Pressable
                style={[styles.pagerButton, page <= 1 ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pagerButtonText}>Trước</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>
                Trang {page}/{totalPages}
              </Text>
              <Pressable
                style={[styles.pagerButton, page >= totalPages ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <Text style={styles.pagerButtonText}>Sau</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundAlt },
    listContent: { padding: 16 },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
    },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary },
  });
