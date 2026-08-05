import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CreateReviewRequest, ReviewCriteriaCode } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useCreateReview } from '../../hooks/useReviews';
import { useAuthStore } from '../../store/authStore';
import { AuthGateModal } from '../../components/AuthGateModal';
import { PhotoUploadGrid } from '../../components/media/PhotoUploadGrid';
import { ApiError } from '../../api/client';
import { REVIEW_CRITERIA_LABELS, REVIEW_CRITERIA_ORDER } from '../../lib/reviewLabels';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

const MAX_REVIEW_PHOTOS = 6;

type Props = NativeStackScreenProps<MainStackParamList, 'WriteReview'>;

const COMMENT_MAX_LENGTH = 2000;
const BILL_MAX_VND = 50_000_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** e.g. "1500000" -> "1.500.000". Digits-only input formatted for display. */
function formatThousands(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function StarPicker({
  value,
  onChange,
  size = 28,
  colors,
  accessibilityLabelPrefix,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  colors: ThemeColors;
  /** e.g. "Đánh giá chung" / "Chất lượng món ăn" — announced as part of each star's label. */
  accessibilityLabelPrefix: string;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.starPickerRow} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabelPrefix}: ${n} sao`}
          accessibilityState={{ selected: n <= value }}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Screen 16 (Write Review), presented as a modal per MainStackNavigator's
 * config. Photo upload (build-prompts/07) uses the shared PhotoUploadGrid
 * component — the exact retrofit of Module 6's original static deferral note.
 *
 * Date-picker judgment call: no date-picker library is installed in
 * mobile/ (checked package.json — no `@react-native-community/datetimepicker`
 * or similar), and adding a new native dependency for one optional field
 * felt disproportionate. Uses Today/Yesterday quick-pick buttons plus a
 * plain "chọn ngày khác" YYYY-MM-DD text input fallback instead.
 */
export function WriteReviewScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const createReview = useCreateReview(restaurantId);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [overallRating, setOverallRating] = useState(0);
  const [criteriaScores, setCriteriaScores] = useState<Partial<Record<ReviewCriteriaCode, number>>>({});
  const [comment, setComment] = useState('');
  const [dishInput, setDishInput] = useState('');
  const [dishesOrdered, setDishesOrdered] = useState<string[]>([]);
  const [billDigits, setBillDigits] = useState('');
  const [partySize, setPartySize] = useState(0);
  const [visitedAt, setVisitedAt] = useState<string | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateText, setCustomDateText] = useState('');
  const [waitTimeMinutes, setWaitTimeMinutes] = useState('');
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const ratedCriteriaCount = Object.values(criteriaScores).filter((v) => (v ?? 0) > 0).length;
  const canSubmit = overallRating >= 1 && ratedCriteriaCount >= 1 && !createReview.isPending;

  function setCriteriaScore(code: ReviewCriteriaCode, score: number) {
    setCriteriaScores((prev) => ({ ...prev, [code]: prev[code] === score ? 0 : score }));
  }

  function handleAddDish() {
    const trimmed = dishInput.trim();
    if (!trimmed) return;
    if (!dishesOrdered.includes(trimmed)) {
      setDishesOrdered((prev) => [...prev, trimmed]);
    }
    setDishInput('');
  }

  function handleRemoveDish(dish: string) {
    setDishesOrdered((prev) => prev.filter((d) => d !== dish));
  }

  function handleBillChange(text: string) {
    const digits = text.replace(/[^0-9]/g, '');
    const num = digits ? Math.min(Number(digits), BILL_MAX_VND - 1) : 0;
    setBillDigits(num > 0 ? String(num) : '');
  }

  const billDisplay = useMemo(() => formatThousands(billDigits), [billDigits]);

  function handleSubmit() {
    if (!canSubmit) return;
    setFormError(null);

    const ratings = REVIEW_CRITERIA_ORDER.filter((code) => (criteriaScores[code] ?? 0) > 0).map((code) => ({
      criteriaCode: code,
      score: criteriaScores[code]!,
    }));

    const body: CreateReviewRequest = {
      restaurantId,
      overallRating,
      ratings,
      comment: comment.trim() ? comment.trim() : undefined,
      dishesOrdered: dishesOrdered.length > 0 ? dishesOrdered : undefined,
      billTotalVnd: billDigits ? Number(billDigits) : undefined,
      partySize: partySize > 0 ? partySize : undefined,
      visitedAt: visitedAt ?? undefined,
      waitTimeMinutes: waitTimeMinutes ? Number(waitTimeMinutes) : undefined,
      wouldReturn: wouldReturn ?? undefined,
      photoIds: photoIds.length > 0 ? photoIds : undefined,
    };

    createReview.mutate(body, {
      onSuccess: (dto) => {
        Alert.alert(
          dto.status === 'published' ? 'Đã đăng' : 'Đang chờ duyệt',
          dto.status === 'published'
            ? 'Đánh giá của bạn đã được đăng.'
            : 'Đánh giá của bạn đang chờ duyệt trước khi hiển thị công khai.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          Alert.alert('Không thể gửi đánh giá', 'Bạn đã đánh giá quán này gần đây');
          return;
        }
        if (error instanceof ApiError && error.status === 400) {
          const message = Array.isArray(error.body?.message)
            ? error.body!.message.join('\n')
            : error.body?.message ?? 'Dữ liệu không hợp lệ.';
          setFormError(message);
          return;
        }
        setFormError('Không thể gửi đánh giá. Vui lòng thử lại.');
      },
    });
  }

  // See the module-level judgment-call note above: RootNavigator only ever
  // mounts MainStack (where this screen lives) when `isAuthenticated` is
  // true, so a true guest can't reach this screen today — this guard is
  // dead code in the current architecture but kept as a cheap,
  // forward-compatible safety net.
  if (!isAuthenticated) {
    return (
      <AuthGateModal
        visible
        message="Đăng nhập để viết đánh giá."
        onDismiss={() => navigation.goBack()}
        onLoginPress={() => navigation.goBack()}
        onRegisterPress={() => navigation.goBack()}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Đánh giá chung *</Text>
        <StarPicker
          value={overallRating}
          onChange={setOverallRating}
          colors={colors}
          accessibilityLabelPrefix="Đánh giá chung"
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Đánh giá theo tiêu chí *</Text>
        <Text style={styles.hint}>Chọn ít nhất 1 tiêu chí. Nhấn lại vào sao đã chọn để bỏ qua.</Text>
        {REVIEW_CRITERIA_ORDER.map((code) => (
          <View key={code} style={styles.criteriaRow}>
            <Text style={styles.criteriaLabel}>{REVIEW_CRITERIA_LABELS[code]}</Text>
            <StarPicker
              value={criteriaScores[code] ?? 0}
              onChange={(n) => setCriteriaScore(code, n)}
              size={20}
              colors={colors}
              accessibilityLabelPrefix={REVIEW_CRITERIA_LABELS[code]}
            />
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Nhận xét</Text>
        <TextInput
          style={styles.textarea}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          placeholder="Chia sẻ trải nghiệm của bạn..."
          placeholderTextColor={colors.textTertiary}
          value={comment}
          onChangeText={setComment}
        />
        <Text style={styles.counterText}>
          {comment.length}/{COMMENT_MAX_LENGTH}
        </Text>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Món đã gọi</Text>
        <View style={styles.dishInputRow}>
          <TextInput
            style={styles.dishInput}
            placeholder="Tên món..."
            placeholderTextColor={colors.textTertiary}
            value={dishInput}
            onChangeText={setDishInput}
            onSubmitEditing={handleAddDish}
            returnKeyType="done"
          />
          <Pressable style={styles.addDishButton} onPress={handleAddDish}>
            <Text style={styles.addDishButtonText}>Thêm</Text>
          </Pressable>
        </View>
        {dishesOrdered.length > 0 ? (
          <View style={styles.tagsRow}>
            {dishesOrdered.map((dish) => (
              <Pressable
                key={dish}
                style={styles.tag}
                onPress={() => handleRemoveDish(dish)}
                accessibilityRole="button"
                accessibilityLabel={`Xoá món ${dish}`}
              >
                <Text style={styles.tagText}>{dish}</Text>
                <Ionicons name="close" size={12} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Tổng hóa đơn (₫)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          value={billDisplay}
          onChangeText={handleBillChange}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Số người</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setPartySize((p) => Math.max(0, p - 1))}
          >
            <Ionicons name="remove" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.stepperValue}>{partySize}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setPartySize((p) => p + 1)}>
            <Ionicons name="add" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Ngày ghé quán</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.chip, visitedAt === todayIso() ? styles.chipActive : null]}
            onPress={() => {
              setVisitedAt(todayIso());
              setShowCustomDate(false);
            }}
          >
            <Text style={[styles.chipText, visitedAt === todayIso() ? styles.chipTextActive : null]}>
              Hôm nay
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, visitedAt === yesterdayIso() ? styles.chipActive : null]}
            onPress={() => {
              setVisitedAt(yesterdayIso());
              setShowCustomDate(false);
            }}
          >
            <Text style={[styles.chipText, visitedAt === yesterdayIso() ? styles.chipTextActive : null]}>
              Hôm qua
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, showCustomDate ? styles.chipActive : null]}
            onPress={() => setShowCustomDate(true)}
          >
            <Text style={[styles.chipText, showCustomDate ? styles.chipTextActive : null]}>Chọn ngày khác</Text>
          </Pressable>
        </View>
        {showCustomDate ? (
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={customDateText}
            onChangeText={(text) => {
              setCustomDateText(text);
              setVisitedAt(/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null);
            }}
          />
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Thời gian chờ (phút)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          value={waitTimeMinutes}
          onChangeText={(text) => setWaitTimeMinutes(text.replace(/[^0-9]/g, ''))}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Bạn có quay lại không?</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.chip, wouldReturn === true ? styles.chipActive : null]}
            onPress={() => setWouldReturn((prev) => (prev === true ? null : true))}
          >
            <Text style={[styles.chipText, wouldReturn === true ? styles.chipTextActive : null]}>Có</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, wouldReturn === false ? styles.chipActive : null]}
            onPress={() => setWouldReturn((prev) => (prev === false ? null : false))}
          >
            <Text style={[styles.chipText, wouldReturn === false ? styles.chipTextActive : null]}>Không</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Ảnh</Text>
        <PhotoUploadGrid ownerType="review" maxPhotos={MAX_REVIEW_PHOTOS} onPhotoIdsChange={setPhotoIds} />

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Pressable
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>
            {createReview.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    sectionTitleSpaced: { marginTop: 20, marginBottom: 4 },
    hint: { fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
    starPickerRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
    criteriaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    criteriaLabel: { fontSize: 13, color: colors.textPrimary },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    counterText: { fontSize: 11, color: colors.textTertiary, textAlign: 'right', marginTop: 4 },
    dishInputRow: { flexDirection: 'row', gap: 8 },
    dishInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    addDishButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    // 14pt, not 13 — see RestaurantDetailScreen's actionButtonText for why
    // onPrimary-on-primary needs the 14pt-bold WCAG AA large-text threshold.
    addDishButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    tagText: { fontSize: 12, color: colors.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepperButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: colors.onPrimary },
    formError: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center' },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    // Matches the `opacity`-based disabled convention used elsewhere
    // (Login/Register/EditProfile's `buttonDisabled`) rather than a
    // hand-picked lighter hex, so it stays correct in both themes for free.
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
