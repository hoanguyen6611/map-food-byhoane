import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatDistanceMeters, formatPriceRange } from '../lib/format';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { FONT_FAMILY } from '../theme/fonts';

/**
 * The subset of fields `RestaurantCard` actually renders — satisfied by both
 * `RestaurantSummaryDto` (search/list/map results) and
 * `FavoriteRestaurantSummaryDto` (Favorites screen, which has no
 * lat/lng/distanceMeters/isOpenNow since it isn't a viewport/geo query).
 * Structural typing means both DTOs are assignable here without an explicit
 * adapter — this card just doesn't render the open/closed badge or distance
 * for callers that don't have that data.
 */
interface RestaurantCardData
  extends Pick<RestaurantSummaryDto, 'id' | 'name' | 'thumbnailUrl' | 'compositeScore' | 'reviewCount' | 'priceRange'> {
  isOpenNow?: boolean;
  distanceMeters?: number | null;
}

interface Props {
  restaurant: RestaurantCardData;
  onPress: () => void;
  /** Omit to render the card without a favorite heart overlay at all. */
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

/**
 * Generic reusable list-item card (docs/04-screen-list.md screen 12) shared
 * by SearchResultScreen, ListScreen, and FavoritesScreen (build-prompts/04,
 * /08). Distinct from the map's compact
 * `src/components/map/RestaurantPreviewCard.tsx`, which stays as the
 * marker-tap bottom-sheet preview and is NOT reused here.
 *
 * Thumbnail renders the restaurant's first real photo when `thumbnailUrl` is
 * set, falling back to a branded emoji placeholder for restaurants with no
 * photos yet; rating is never fabricated — a null `compositeScore` renders
 * "Chưa có đánh giá" instead of a synthesized number.
 *
 * Favorite heart is a small overlay in the top-right corner — tapping it
 * toggles favorite status without triggering the card's own `onPress` (the
 * inner `Pressable` captures the touch itself, so it never bubbles up to the
 * outer card `Pressable`). `isFavorited`/`onToggleFavorite` are supplied by
 * the parent screen (which fetches `useFavoriteIds()` once), NOT fetched
 * per-card, to avoid a redundant live query per list item.
 */
export function RestaurantCard({ restaurant, onPress, isFavorited, onToggleFavorite }: Props) {
  const priceLabel = formatPriceRange(restaurant.priceRange);
  const showFavoriteButton = onToggleFavorite !== undefined;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {restaurant.thumbnailUrl ? (
        <Image source={{ uri: restaurant.thumbnailUrl }} style={styles.thumbnailImage} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.thumbnailEmoji}>🍽️</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.ratingText}>
            {restaurant.compositeScore !== null ? (
              <>
                <Text style={styles.starGlyph}>★</Text> {restaurant.compositeScore.toFixed(1)} ({restaurant.reviewCount})
              </>
            ) : (
              t('restaurantCard.noRating')
            )}
          </Text>
          {priceLabel ? <Text style={styles.dot}>·</Text> : null}
          {priceLabel ? <Text style={styles.priceText}>{priceLabel}đ</Text> : null}
        </View>

        <View style={styles.metaRow}>
          {restaurant.isOpenNow !== undefined ? (
            <View style={[styles.badge, restaurant.isOpenNow ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={styles.badgeText}>{restaurant.isOpenNow ? t('restaurantCard.openNow') : t('restaurantCard.closedNow')}</Text>
            </View>
          ) : null}
          {restaurant.distanceMeters !== null && restaurant.distanceMeters !== undefined ? (
            <Text style={styles.distanceText}>{formatDistanceMeters(restaurant.distanceMeters)}</Text>
          ) : null}
        </View>
      </View>

      {showFavoriteButton ? (
        <Pressable
          style={styles.favoriteButton}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorited
              ? t('restaurantCard.unfavorite', { name: restaurant.name })
              : t('restaurantCard.favorite', { name: restaurant.name })
          }
          accessibilityState={{ selected: isFavorited }}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorited ? colors.favorite : colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/**
 * Loading placeholder for `RestaurantCard` (screen 8/9/10's "skeleton card"
 * loading state) — a handful of static gray blocks, no shimmer animation
 * (not worth a new dependency for this module's scope).
 */
export function RestaurantCardSkeleton() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    thumbnailPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 14,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    thumbnailImage: {
      width: 64,
      height: 64,
      borderRadius: 14,
      marginRight: 12,
    },
    thumbnailEmoji: { fontSize: 28 },
    info: { flex: 1, justifyContent: 'center' },
    name: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
    ratingText: { fontSize: 13, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    starGlyph: { color: colors.star },
    dot: { fontSize: 13, color: colors.textTertiary },
    priceText: { fontSize: 13, color: colors.textPrimary, fontFamily: FONT_FAMILY.bodySemiBold },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    badgeOpen: { backgroundColor: colors.successBg },
    badgeClosed: { backgroundColor: colors.errorBg },
    badgeText: { fontSize: 11, fontFamily: FONT_FAMILY.metaMedium, color: colors.textPrimary },
    distanceText: { fontSize: 12, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    skeletonBlock: { backgroundColor: colors.surfaceAlt, borderRadius: 8 },
    skeletonLineWide: { height: 14, width: '70%', marginBottom: 8 },
    skeletonLineNarrow: { height: 12, width: '45%', marginBottom: 8 },
  });
