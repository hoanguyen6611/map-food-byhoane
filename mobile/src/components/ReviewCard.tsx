import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ReviewDto } from '@foodmap/shared-types';
import { formatReviewDate, formatVndFull } from '../lib/reviewLabels';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { FONT_FAMILY } from '../theme/fonts';

interface ReviewCardProps {
  review: ReviewDto;
  /** Compact rendering for RestaurantDetailScreen's preview (author+rating+comment snippet only). */
  compact?: boolean;
}

function Stars({ rating, size = 14, color, styles }: { rating: number; size?: number; color: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={size} color={color} />
      ))}
    </View>
  );
}

/**
 * Reusable review card (build-prompts/06 mobile). Used full-size on
 * ReviewsScreen and in `compact` mode as RestaurantDetailScreen's preview
 * (`reviews[]`, ≤5 published newest-first items from the DTO).
 */
export function ReviewCard({ review, compact = false }: ReviewCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  return (
    <View style={[styles.card, compact ? styles.cardCompact : null]}>
      <View style={styles.headerRow}>
        <Text style={styles.author} numberOfLines={1}>
          {review.author.displayName}
        </Text>
        <Text style={styles.date}>{formatReviewDate(review.createdAt)}</Text>
      </View>

      <View style={styles.ratingRow}>
        <Stars rating={review.overallRating} color={colors.star} styles={styles} />
        {review.status === 'pending' ? (
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={styles.badgeText}>{t('review.pending')}</Text>
          </View>
        ) : null}
        {review.editedAt ? (
          <Text style={styles.editedText}>{t('review.edited')}</Text>
        ) : null}
      </View>

      {review.comment ? (
        <Text style={styles.comment} numberOfLines={compact ? 3 : undefined}>
          {review.comment}
        </Text>
      ) : null}

      {!compact && review.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
          {review.photos.map((photo) => (
            <Image key={photo.id} source={{ uri: photo.url }} style={styles.photoThumb} />
          ))}
        </ScrollView>
      ) : null}

      {!compact ? (
        <>
          {review.dishesOrdered.length > 0 ? (
            <View style={styles.tagsRow}>
              {review.dishesOrdered.map((dish) => (
                <View key={dish} style={styles.tag}>
                  <Text style={styles.tagText}>{dish}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {review.billTotalVnd !== null ? (
              <Text style={styles.metaText}>{t('review.bill', { amount: formatVndFull(review.billTotalVnd) })}</Text>
            ) : null}
            {review.partySize !== null ? (
              <Text style={styles.metaText}>{t('review.partySize', { count: review.partySize })}</Text>
            ) : null}
            {review.waitTimeMinutes !== null ? (
              <Text style={styles.metaText}>{t('review.waitTime', { minutes: review.waitTimeMinutes })}</Text>
            ) : null}
          </View>

          {review.wouldReturn !== null ? (
            <View style={styles.rowStart}>
              <Ionicons
                name={review.wouldReturn ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={14}
                color={review.wouldReturn ? colors.success : colors.error}
              />
              <Text style={[styles.returnText, { color: review.wouldReturn ? colors.success : colors.error }]}>
                {review.wouldReturn ? t('review.wouldReturn') : t('review.wouldNotReturn')}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    cardCompact: { paddingVertical: 8 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    author: { fontSize: 14, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
    date: { fontSize: 12, color: colors.textTertiary, fontFamily: FONT_FAMILY.meta },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    starsRow: { flexDirection: 'row', gap: 1 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
    badgePending: { backgroundColor: colors.warningBg },
    badgeText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold, color: colors.warning },
    editedText: { fontSize: 11, color: colors.textTertiary, fontStyle: 'italic', fontFamily: FONT_FAMILY.meta },
    comment: { fontSize: 13, color: colors.textPrimary, marginTop: 6, lineHeight: 19, fontFamily: FONT_FAMILY.body },
    photosRow: { marginTop: 8 },
    photoThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: colors.surfaceAlt },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tag: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 11, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    metaText: { fontSize: 12, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    rowStart: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    returnText: { fontSize: 12, fontFamily: FONT_FAMILY.bodySemiBold },
  });
