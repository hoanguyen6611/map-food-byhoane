import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatDistanceMeters, formatPriceRange } from '../lib/format';

interface Props {
  restaurant: RestaurantSummaryDto;
  onPress: () => void;
}

/**
 * Generic reusable list-item card (docs/04-screen-list.md screen 12) shared
 * by SearchResultScreen and ListScreen (build-prompts/04). Distinct from the
 * map's compact `src/components/map/RestaurantPreviewCard.tsx`, which stays
 * as the marker-tap bottom-sheet preview and is NOT reused here.
 *
 * Thumbnail is always a branded placeholder (`thumbnailUrl` is honestly null
 * until build-prompts/07's media pipeline exists); rating is never
 * fabricated — a null `compositeScore` renders "Chưa có đánh giá" instead of
 * a synthesized number.
 */
export function RestaurantCard({ restaurant, onPress }: Props) {
  const priceLabel = formatPriceRange(restaurant.priceRange);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.thumbnailPlaceholder}>
        <Text style={styles.thumbnailEmoji}>🍽️</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.ratingText}>
            {restaurant.compositeScore !== null
              ? `★ ${restaurant.compositeScore.toFixed(1)} (${restaurant.reviewCount})`
              : 'Chưa có đánh giá'}
          </Text>
          {priceLabel ? <Text style={styles.dot}>·</Text> : null}
          {priceLabel ? <Text style={styles.priceText}>{priceLabel}đ</Text> : null}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, restaurant.isOpenNow ? styles.badgeOpen : styles.badgeClosed]}>
            <Text style={styles.badgeText}>{restaurant.isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}</Text>
          </View>
          {restaurant.distanceMeters !== null ? (
            <Text style={styles.distanceText}>{formatDistanceMeters(restaurant.distanceMeters)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Loading placeholder for `RestaurantCard` (screen 8/9/10's "skeleton card"
 * loading state) — a handful of static gray blocks, no shimmer animation
 * (not worth a new dependency for this module's scope).
 */
export function RestaurantCardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.thumbnailPlaceholder, styles.skeletonBlock]} />
      <View style={styles.info}>
        <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
        <View style={[styles.skeletonBlock, styles.skeletonLineNarrow]} />
        <View style={[styles.skeletonBlock, styles.skeletonLineNarrow]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#fde8e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumbnailEmoji: { fontSize: 28 },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
  ratingText: { fontSize: 13, color: '#888' },
  dot: { fontSize: 13, color: '#bbb' },
  priceText: { fontSize: 13, color: '#444', fontWeight: '600' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeOpen: { backgroundColor: '#e3f6e8' },
  badgeClosed: { backgroundColor: '#f6e3e3' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#333' },
  distanceText: { fontSize: 12, color: '#666' },
  skeletonBlock: { backgroundColor: '#eee', borderRadius: 6 },
  skeletonLineWide: { height: 14, width: '70%', marginBottom: 8 },
  skeletonLineNarrow: { height: 12, width: '45%', marginBottom: 8 },
});
