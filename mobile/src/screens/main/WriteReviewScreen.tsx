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
import { useTranslation } from 'react-i18next';
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
import { FONT_FAMILY } from '../../theme/fonts';

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
  const { t } = useTranslation();
  const styles = createStyles(colors);
  return (
    <View style={styles.starPickerRow} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('writeReview.starAccessibilityLabel', { prefix: accessibilityLabelPrefix, n })}
          accessibilityState={{ selected: n <= value }}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.star} />
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
  const { t } = useTranslation();
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
          dto.status === 'published' ? t('writeReview.publishedTitle') : t('writeReview.pendingTitle'),
          dto.status === 'published' ? t('writeReview.publishedBody') : t('writeReview.pendingBody'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
        );
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          Alert.alert(t('writeReview.duplicateTitle'), t('writeReview.duplicateBody'));
          return;
        }
        if (error instanceof ApiError && error.status === 400) {
          const message = Array.isArray(error.body?.message)
            ? error.body!.message.join('\n')
            : error.body?.message ?? t('writeReview.invalidData');
          setFormError(message);
          return;
        }
        setFormError(t('writeReview.submitError'));
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
        message={t('reviews.authGateMessage')}
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
        <Text style={styles.sectionTitle}>{t('writeReview.overallRatingLabel')}</Text>
        <StarPicker
          value={overallRating}
          onChange={setOverallRating}
          colors={colors}
          accessibilityLabelPrefix={t('writeReview.overallRatingPrefix')}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.criteriaLabel')}</Text>
        <Text style={styles.hint}>{t('writeReview.criteriaHint')}</Text>
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

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.commentLabel')}</Text>
        <TextInput
          style={styles.textarea}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={t('writeReview.commentPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={comment}
          onChangeText={setComment}
        />
        <Text style={styles.counterText}>
          {comment.length}/{COMMENT_MAX_LENGTH}
        </Text>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.dishesLabel')}</Text>
        <View style={styles.dishInputRow}>
          <TextInput
            style={styles.dishInput}
            placeholder={t('writeReview.dishPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={dishInput}
            onChangeText={setDishInput}
            onSubmitEditing={handleAddDish}
            returnKeyType="done"
          />
          <Pressable style={styles.addDishButton} onPress={handleAddDish}>
            <Text style={styles.addDishButtonText}>{t('writeReview.addButton')}</Text>
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
                accessibilityLabel={t('writeReview.removeDishAccessibilityLabel', { dish })}
              >
                <Text style={styles.tagText}>{dish}</Text>
                <Ionicons name="close" size={12} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.billLabel')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          value={billDisplay}
          onChangeText={handleBillChange}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.partySizeLabel')}</Text>
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

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.visitedAtLabel')}</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.chip, visitedAt === todayIso() ? styles.chipActive : null]}
            onPress={() => {
              setVisitedAt(todayIso());
              setShowCustomDate(false);
            }}
          >
            <Text style={[styles.chipText, visitedAt === todayIso() ? styles.chipTextActive : null]}>
              {t('writeReview.today')}
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
              {t('writeReview.yesterday')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, showCustomDate ? styles.chipActive : null]}
            onPress={() => setShowCustomDate(true)}
          >
            <Text style={[styles.chipText, showCustomDate ? styles.chipTextActive : null]}>{t('writeReview.chooseOtherDate')}</Text>
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

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.waitTimeLabel')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          value={waitTimeMinutes}
          onChangeText={(text) => setWaitTimeMinutes(text.replace(/[^0-9]/g, ''))}
        />

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.wouldReturnLabel')}</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.chip, wouldReturn === true ? styles.chipActive : null]}
            onPress={() => setWouldReturn((prev) => (prev === true ? null : true))}
          >
            <Text style={[styles.chipText, wouldReturn === true ? styles.chipTextActive : null]}>{t('writeReview.yes')}</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, wouldReturn === false ? styles.chipActive : null]}
            onPress={() => setWouldReturn((prev) => (prev === false ? null : false))}
          >
            <Text style={[styles.chipText, wouldReturn === false ? styles.chipTextActive : null]}>{t('writeReview.no')}</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('writeReview.photosLabel')}</Text>
        <PhotoUploadGrid ownerType="review" maxPhotos={MAX_REVIEW_PHOTOS} onPhotoIdsChange={setPhotoIds} />

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Pressable
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>
            {createReview.isPending ? t('addRestaurant.submitting') : t('writeReview.submitButton')}
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
    sectionTitle: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    sectionTitleSpaced: { marginTop: 20, marginBottom: 4 },
    hint: { fontSize: 12, color: colors.textTertiary, marginBottom: 8, fontFamily: FONT_FAMILY.meta },
    starPickerRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
    criteriaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    criteriaLabel: { fontSize: 13, color: colors.textPrimary, fontFamily: FONT_FAMILY.body },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontFamily: FONT_FAMILY.body,
    },
    counterText: { fontSize: 11, color: colors.textTertiary, textAlign: 'right', marginTop: 4, fontFamily: FONT_FAMILY.meta },
    dishInputRow: { flexDirection: 'row', gap: 8 },
    dishInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontFamily: FONT_FAMILY.body,
    },
    addDishButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    addDishButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 14 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    tagText: { fontSize: 12, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontFamily: FONT_FAMILY.body,
    },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepperButton: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      fontSize: 16,
      fontFamily: FONT_FAMILY.bodyBold,
      color: colors.textPrimary,
      minWidth: 24,
      textAlign: 'center',
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textSecondary, fontFamily: FONT_FAMILY.bodySemiBold },
    chipTextActive: { color: colors.onPrimary },
    formError: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center', fontFamily: FONT_FAMILY.body },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    // Matches the `opacity`-based disabled convention used elsewhere
    // (Login/Register/EditProfile's `buttonDisabled`) rather than a
    // hand-picked lighter hex, so it stays correct in both themes for free.
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 15 },
  });
