import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatDistanceMeters, formatPriceRange } from '../../lib/format';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

interface Props {
  restaurant: RestaurantSummaryDto;
  /** Client-computed haversine distance (bounds queries never return one — see useRestaurantsInBounds). */
  distanceMeters: number | null;
  onClose: () => void;
  onViewDetail: () => void;
  /** Omit to render the card without a favorite heart button at all. */
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

/**
 * Marker-tap preview card per US-B4 / screen 7's bottom-sheet spec: name,
 * thumbnail (the restaurant's first real photo when `thumbnailUrl` is set,
 * else a branded emoji placeholder), rating placeholder (compositeScore
 * is null until build-prompts/06 — never fabricate a score), price range,
 * distance, an open/closed badge, and a favorite heart button
 * (build-prompts/08 — `isFavorited`/`onToggleFavorite` come from MapScreen's
 * single `useFavoriteIds()` call, not a per-card query), plus a button into
 * Restaurant Detail.
 */
export function RestaurantPreviewCard({
  restaurant,
  distanceMeters,
  onClose,
  onViewDetail,
  isFavorited,
  onToggleFavorite,
}: Props) {
  const priceLabel = formatPriceRange(restaurant.priceRange);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Đóng"
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {onToggleFavorite ? (
        <Pressable
          style={styles.favoriteButton}
          onPress={onToggleFavorite}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isFavorited ? `Bỏ yêu thích ${restaurant.name}` : `Yêu thích ${restaurant.name}`}
          accessibilityState={{ selected: isFavorited }}
        >
          <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={16} color={colors.primary} />
        </Pressable>
      ) : null}

      <View style={styles.row}>
        {restaurant.thumbnailUrl ? (
          <Image source={{ uri: restaurant.thumbnailUrl }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailEmoji}>🍽️</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {restaurant.name}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, restaurant.isOpenNow ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={styles.badgeText}>{restaurant.isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}</Text>
            </View>
            {distanceMeters !== null ? (
              <Text style={styles.distanceText}>{formatDistanceMeters(distanceMeters)}</Text>
            ) : null}
          </View>

          <Text style={styles.ratingText}>
            {restaurant.compositeScore !== null
              ? `${restaurant.compositeScore.toFixed(1)} (${restaurant.reviewCount} đánh giá)`
              : 'Chưa có đánh giá'}
          </Text>

          {priceLabel ? <Text style={styles.priceText}>{priceLabel} đ</Text> : null}
        </View>
      </View>

      <Pressable style={styles.detailButton} onPress={onViewDetail}>
        <Text style={styles.detailButtonText}>Xem chi tiết</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    closeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    closeButtonText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 44,
      zIndex: 1,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    row: { flexDirection: 'row' },
    thumbnailPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    thumbnailImage: {
      width: 72,
      height: 72,
      borderRadius: 12,
      marginRight: 12,
    },
    thumbnailEmoji: { fontSize: 32 },
    info: { flex: 1, paddingRight: 24 },
    name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeOpen: { backgroundColor: colors.successBg },
    badgeClosed: { backgroundColor: colors.errorBg },
    badgeText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    distanceText: { fontSize: 12, color: colors.textSecondary },
    ratingText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    priceText: { fontSize: 13, color: colors.textPrimary, marginTop: 4, fontWeight: '600' },
    detailButton: {
      marginTop: 14,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    detailButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
