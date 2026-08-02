import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MenuItemDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantDetail } from '../../hooks/useRestaurantDetail';
import { formatVndFull } from '../../lib/restaurantLabels';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'Menu'>;

const UNCATEGORIZED_LABEL = 'Khác';

/** Groups every item across all of a restaurant's menus by `category` (null -> "Khác"), preserving first-seen category order. */
function groupByCategory(items: MenuItemDto[]): { category: string; items: MenuItemDto[] }[] {
  const order: string[] = [];
  const groups = new Map<string, MenuItemDto[]>();
  for (const item of items) {
    const category = item.category ?? UNCATEGORIZED_LABEL;
    if (!groups.has(category)) {
      groups.set(category, []);
      order.push(category);
    }
    groups.get(category)!.push(item);
  }
  return order.map((category) => ({ category, items: groups.get(category)! }));
}

/**
 * Screen 14 (Menu) per docs/04-screen-list.md /
 * build-prompts/05-restaurant-detail-admin-seed.md. Flattens every menu the
 * restaurant has (`menus[].items`) into one list grouped by category — the
 * DTO supports multiple named menus, but there's no product requirement yet
 * to render them as separate tabs, so a single grouped list keeps this
 * simple and correct for the common one-menu case.
 */
export function MenuScreen({ route }: Props) {
  const { restaurantId } = route.params;
  const detailQuery = useRestaurantDetail(restaurantId);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (detailQuery.isError) {
    const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{isNotFound ? 'Không tìm thấy quán' : 'Không có kết nối'}</Text>
        {!isNotFound ? (
          <Pressable style={styles.retryButton} onPress={() => detailQuery.refetch()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const allItems = detailQuery.data?.menus.flatMap((menu) => menu.items) ?? [];

  if (allItems.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>Quán này chưa cập nhật thực đơn</Text>
      </View>
    );
  }

  const groups = groupByCategory(allItems);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {groups.map((group) => (
        <View key={group.category} style={styles.group}>
          <Text style={styles.groupTitle}>{group.category}</Text>
          {group.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemNameRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.isPopular ? (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Phổ biến</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>{formatVndFull(item.priceVnd)}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 32 },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
      gap: 12,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: colors.error, textAlign: 'center' },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' },
    group: { marginBottom: 20 },
    groupTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
    itemName: { fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
    popularBadge: { backgroundColor: colors.primarySurface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    // `primaryStrong`, not `primary` — this text is too small to qualify for
    // WCAG AA's large-text exemption (see ThemeColors.primaryStrong's doc comment).
    popularBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryStrong },
    itemPrice: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  });
