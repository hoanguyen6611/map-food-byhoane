import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatPriceRange } from '../lib/format';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { FONT_FAMILY } from '../theme/fonts';

// Same structural-subset trick as RestaurantCard.tsx — satisfied by
// RestaurantSummaryDto without an adapter.
interface RestaurantGridCardData
  extends Pick<RestaurantSummaryDto, 'id' | 'name' | 'thumbnailUrl' | 'compositeScore' | 'reviewCount' | 'priceRange'> {}

interface Props {
  restaurant: RestaurantGridCardData;
  onPress: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}

/**
 * 2-column grid card ("Ngon v3" Home screen's "Món được chấm cao" section —
 * mockup shows this as a dish card, but there's no dish-level rating/like
 * anywhere in the backend, see the reskin plan's gap list, so this renders
 * the RESTAURANT itself instead of fabricating a fake dish rating. Distinct
 * from `RestaurantCard.tsx` (horizontal row, used by Search/Saved/Explore's
 * leaderboard) since the mockup's grid layout is vertical: photo on top,
 * name/score/price stacked below.
 */
export function RestaurantGridCard({ restaurant, onPress, isFavorited, onToggleFavorite }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const priceLabel = formatPriceRange(restaurant.priceRange);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.thumb}>
        {restaurant.thumbnailUrl ? (
          <Image source={{ uri: restaurant.thumbnailUrl }} style={styles.thumbImage} />
        ) : (
          <Text style={styles.thumbEmoji}>🍽️</Text>
        )}

        {restaurant.compositeScore !== null ? (
          <View style={styles.scorePill}>
            <Ionicons name="star" size={11} color={colors.star} />
            <Text style={styles.scorePillText}>{restaurant.compositeScore.toFixed(1)}</Text>
          </View>
        ) : null}

        <Pressable
          style={styles.favoriteButton}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
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
            size={14}
            color={isFavorited ? colors.favorite : colors.textTertiary}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <View style={styles.metaRow}>
          {priceLabel ? <Text style={styles.price}>{priceLabel}đ</Text> : null}
          <Text style={styles.reviewCount}>
            {restaurant.compositeScore !== null ? t('restaurantCard.reviewCountShort', { count: restaurant.reviewCount }) : t('restaurantCard.noRating')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 10,
      gap: 10,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    thumb: {
      height: 118,
      borderRadius: 14,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImage: { width: '100%', height: '100%' },
    thumbEmoji: { fontSize: 30 },
    scorePill: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    scorePillText: { fontSize: 11, fontFamily: FONT_FAMILY.buttonSemiBold, color: colors.textPrimary },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    body: { gap: 3, paddingHorizontal: 2, paddingBottom: 2 },
    name: { fontSize: 13, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: 13, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    reviewCount: { fontSize: 11, color: colors.textTertiary, fontFamily: FONT_FAMILY.meta },
  });
