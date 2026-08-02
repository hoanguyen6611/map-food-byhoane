import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReviewDto } from '@foodmap/shared-types';
import { formatReviewDate, formatVndFull } from '../lib/reviewLabels';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';

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
        <Stars rating={review.overallRating} color={colors.primary} styles={styles} />
        {review.status === 'pending' ? (
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={styles.badgeText}>Đang chờ duyệt</Text>
          </View>
        ) : null}
        {review.editedAt ? (
          <Text style={styles.editedText}>Đã chỉnh sửa</Text>
        ) : null}
      </View>

      {review.comment ? (
        <Text style={styles.comment} numberOfLines={compact ? 3 : undefined}>
          {review.comment}
        </Text>
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
              <Text style={styles.metaText}>Hóa đơn: {formatVndFull(review.billTotalVnd)}</Text>
            ) : null}
            {review.partySize !== null ? (
              <Text style={styles.metaText}>{review.partySize} người</Text>
            ) : null}
            {review.waitTimeMinutes !== null ? (
              <Text style={styles.metaText}>Chờ {review.waitTimeMinutes} phút</Text>
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
                {review.wouldReturn ? 'Sẽ quay lại' : 'Sẽ không quay lại'}
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
    author: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
    date: { fontSize: 12, color: colors.textTertiary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    starsRow: { flexDirection: 'row', gap: 1 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    badgePending: { backgroundColor: colors.warningBg },
    badgeText: { fontSize: 10, fontWeight: '700', color: colors.warning },
    editedText: { fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' },
    comment: { fontSize: 13, color: colors.textPrimary, marginTop: 6, lineHeight: 19 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tag: { backgroundColor: colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 11, color: colors.textSecondary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    metaText: { fontSize: 12, color: colors.textSecondary },
    rowStart: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    returnText: { fontSize: 12, fontWeight: '600' },
  });
