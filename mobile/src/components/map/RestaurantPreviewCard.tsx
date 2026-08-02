import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatDistanceMeters, formatPriceRange } from '../../lib/format';

interface Props {
  restaurant: RestaurantSummaryDto;
  /** Client-computed haversine distance (bounds queries never return one — see useRestaurantsInBounds). */
  distanceMeters: number | null;
  onClose: () => void;
  onViewDetail: () => void;
}

/**
 * Marker-tap preview card per US-B4 / screen 7's bottom-sheet spec: name,
 * thumbnail placeholder (thumbnailUrl is honestly always null for now — no
 * media pipeline until build-prompts/07), rating placeholder (compositeScore
 * is null until build-prompts/06 — never fabricate a score), price range,
 * distance, and an open/closed badge, plus a button into Restaurant Detail
 * (placeholder screen until Module 5).
 */
export function RestaurantPreviewCard({ restaurant, distanceMeters, onClose, onViewDetail }: Props) {
  const priceLabel = formatPriceRange(restaurant.priceRange);

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      <View style={styles.row}>
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.thumbnailEmoji}>🍽️</Text>
        </View>

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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
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
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: { fontSize: 14, color: '#555', fontWeight: '700' },
  row: { flexDirection: 'row' },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#fde8e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumbnailEmoji: { fontSize: 32 },
  info: { flex: 1, paddingRight: 24 },
  name: { fontSize: 16, fontWeight: '700', color: '#222' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeOpen: { backgroundColor: '#e3f6e8' },
  badgeClosed: { backgroundColor: '#f6e3e3' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
  distanceText: { fontSize: 12, color: '#666' },
  ratingText: { fontSize: 13, color: '#888', marginTop: 6 },
  priceText: { fontSize: 13, color: '#444', marginTop: 4, fontWeight: '600' },
  detailButton: {
    marginTop: 14,
    backgroundColor: '#e4572e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
