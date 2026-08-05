import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useContribution } from '../../hooks/useContributions';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'SubmissionStatus'>;

const CONTENT_KIND_LABELS: Record<string, string> = {
  new_restaurant: 'Quán mới',
  edit_suggestion: 'Đề xuất chỉnh sửa',
  status_update: 'Cập nhật trạng thái',
  closure_report: 'Báo cáo đóng cửa',
};

/**
 * Screen (Submission Status) per build-prompts/07 — timeline UI reflecting
 * Contribution/ModerationResult state; polls every 5s while still
 * pending/in_review (see useContribution). Resubmit-after-edit-request
 * creates a FRESH contribution rather than mutating the old one (matches
 * the backend's own design — a Contribution row is an immutable audit
 * entry) — for `new_restaurant` this means going back into Add Restaurant;
 * for other types, a lighter guidance message, since pre-filling the whole
 * multi-step form from the old payload is out of this pass's scope.
 */
export function SubmissionStatusScreen({ route, navigation }: Props) {
  const { contributionId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const query = useContribution(contributionId);

  if (query.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>Không thể tải trạng thái đóng góp.</Text>
      </View>
    );
  }

  const contribution = query.data;
  const steps = buildTimelineSteps(contribution.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {CONTENT_KIND_LABELS[contribution.type] ?? 'Đóng góp'}
        {contribution.targetRestaurantName ? ` — ${contribution.targetRestaurantName}` : ''}
      </Text>

      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={step.label} style={styles.timelineRow}>
            <View style={styles.timelineMarkerColumn}>
              <Ionicons
                name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={step.done ? (step.isNegative ? colors.error : colors.primary) : colors.textTertiary}
              />
              {index < steps.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineTextColumn}>
              <Text style={[styles.timelineLabel, step.done ? styles.timelineLabelActive : null]}>{step.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {contribution.aiReason && (contribution.status === 'rejected' || contribution.status === 'edit_requested') ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Lý do</Text>
          <Text style={styles.reasonText}>{contribution.aiReason}</Text>
        </View>
      ) : null}

      {contribution.status === 'edit_requested' ? (
        <Pressable
          style={styles.resubmitButton}
          onPress={() => {
            if (contribution.type === 'new_restaurant') {
              navigation.navigate('AddRestaurant');
            }
          }}
        >
          <Text style={styles.resubmitButtonText}>
            {contribution.type === 'new_restaurant' ? 'Gửi lại thông tin quán' : 'Chỉnh sửa & gửi lại'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

interface TimelineStep {
  label: string;
  done: boolean;
  isNegative?: boolean;
}

function buildTimelineSteps(status: string): TimelineStep[] {
  const steps: TimelineStep[] = [
    { label: 'Đã gửi', done: true },
    { label: 'Đang xử lý', done: true },
  ];
  switch (status) {
    case 'pending':
    case 'in_review':
      steps.push({ label: 'Đang chờ duyệt', done: true });
      break;
    case 'auto_approved':
    case 'approved':
      steps.push({ label: 'Đã duyệt', done: true });
      break;
    case 'rejected':
      steps.push({ label: 'Bị từ chối', done: true, isNegative: true });
      break;
    case 'edit_requested':
      steps.push({ label: 'Cần chỉnh sửa', done: true, isNegative: true });
      break;
  }
  return steps;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48 },
    centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    errorText: { fontSize: 14, color: colors.error },
    title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 20 },
    timeline: {},
    timelineRow: { flexDirection: 'row' },
    timelineMarkerColumn: { alignItems: 'center', width: 30 },
    timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.divider, marginVertical: 2 },
    timelineTextColumn: { flex: 1, paddingBottom: 20 },
    timelineLabel: { fontSize: 14, color: colors.textTertiary },
    timelineLabelActive: { color: colors.textPrimary, fontWeight: '600' },
    reasonBox: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, marginTop: 8 },
    reasonLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
    reasonText: { fontSize: 13, color: colors.textPrimary },
    resubmitButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
    resubmitButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
