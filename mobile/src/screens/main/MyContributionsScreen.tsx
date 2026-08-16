import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ContributionListItemDto, ContributionStatus, ContributionType } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useMyContributions } from '../../hooks/useContributions';
import { formatReviewDate } from '../../lib/reviewLabels';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'MyContributions'>;

const PAGE_SIZE = 20;

// Same code -> translation-key mapping as SubmissionStatusScreen (per-screen
// duplication is this codebase's established convention for small label
// maps — see AddRestaurantScreen/FilterScreen's own comments on this).
const TYPE_LABEL_KEYS: Record<ContributionType, string> = {
  new_restaurant: 'submissionStatus.kindNewRestaurant',
  edit_suggestion: 'submissionStatus.kindEditSuggestion',
  status_update: 'submissionStatus.kindStatusUpdate',
  closure_report: 'submissionStatus.kindClosureReport',
};

// Collapses SubmissionStatusScreen's multi-step timeline into a single
// current-status label — a list row shows "where it's at now", not the
// full history that screen's timeline visualizes.
const STATUS_LABEL_KEYS: Record<ContributionStatus, string> = {
  pending: 'submissionStatus.stepPending',
  in_review: 'submissionStatus.stepPending',
  auto_approved: 'submissionStatus.stepApproved',
  approved: 'submissionStatus.stepApproved',
  rejected: 'submissionStatus.stepRejected',
  edit_requested: 'submissionStatus.stepEditRequested',
};

const NEGATIVE_STATUSES = new Set<ContributionStatus>(['rejected', 'edit_requested']);
const PENDING_STATUSES = new Set<ContributionStatus>(['pending', 'in_review']);

function statusBadgeStyleKey(status: ContributionStatus): 'positive' | 'pending' | 'negative' {
  if (NEGATIVE_STATUSES.has(status)) return 'negative';
  if (PENDING_STATUSES.has(status)) return 'pending';
  return 'positive';
}

function ContributionRow({
  contribution,
  onPress,
  colors,
}: {
  contribution: ContributionListItemDto;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const badgeKind = statusBadgeStyleKey(contribution.status);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={1}>
          {t(TYPE_LABEL_KEYS[contribution.type])}
          {contribution.targetRestaurantName ? ` — ${contribution.targetRestaurantName}` : ''}
        </Text>
        <Text style={styles.date}>{formatReviewDate(contribution.createdAt)}</Text>
      </View>
      <View style={[styles.badge, styles[`badge_${badgeKind}`]]}>
        <Text style={[styles.badgeText, styles[`badgeText_${badgeKind}`]]}>{t(STATUS_LABEL_KEYS[contribution.status])}</Text>
      </View>
    </Pressable>
  );
}

/** Profile → "My Contributions" — every restaurant/edit/status contribution the current user has submitted, newest first. Tapping a row opens its full status timeline (SubmissionStatusScreen). */
export function MyContributionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const contributionsQuery = useMyContributions(page, PAGE_SIZE);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const items = contributionsQuery.data?.items ?? [];
  const total = contributionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showEmpty = contributionsQuery.isSuccess && items.length === 0;

  if (contributionsQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (contributionsQuery.isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
        <Text style={styles.errorBody}>{t('myContributions.errorBody')}</Text>
        <Pressable style={styles.retryButton} onPress={() => contributionsQuery.refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>{t('myContributions.emptyText')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContributionRow
            contribution={item}
            colors={colors}
            onPress={() => navigation.navigate('SubmissionStatus', { contributionId: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagerRow}>
              <Pressable
                style={[styles.pagerButton, page <= 1 ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pagerButtonText}>{t('common.prev')}</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>{t('common.pageOf', { page, totalPages })}</Text>
              <Pressable
                style={[styles.pagerButton, page >= totalPages ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <Text style={styles.pagerButtonText}>{t('common.next')}</Text>
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
    container: { flex: 1, backgroundColor: colors.background },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
    },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    rowBody: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    date: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    badge_positive: { backgroundColor: colors.successBg },
    badge_pending: { backgroundColor: colors.warningBg },
    badge_negative: { backgroundColor: colors.errorBg },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeText_positive: { color: colors.success },
    badgeText_pending: { color: colors.warning },
    badgeText_negative: { color: colors.error },
    separator: { height: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary },
  });
