import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  CreateRestaurantContributionRequest,
  CuisineCode,
  DuplicateCandidateDto,
  PriceRangeCode,
  RestaurantCategoryCode,
} from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useAddRestaurantDraftStore } from '../../store/addRestaurantDraftStore';
import { useCreateRestaurantContribution } from '../../hooks/useContributions';
import { PhotoUploadGrid } from '../../components/media/PhotoUploadGrid';
import { CATEGORY_LABELS } from '../../lib/restaurantLabels';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'AddRestaurant'>;

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as RestaurantCategoryCode[];

// Duplicates FilterScreen's local label maps on purpose — same
// self-contained-per-screen convention already established there rather
// than reaching into another screen's private module.
const CUISINE_LABELS: Record<CuisineCode, string> = {
  mon_viet: 'Món Việt',
  mon_han: 'Món Hàn',
  mon_nhat: 'Món Nhật',
  mon_chay: 'Món chay',
  mon_thai: 'Món Thái',
  mon_au: 'Món Âu',
};
const CUISINE_OPTIONS = Object.keys(CUISINE_LABELS) as CuisineCode[];

const PRICE_LABELS: Record<PriceRangeCode, string> = {
  under_50k: 'Dưới 50k',
  '50_100k': '50k - 100k',
  '100_200k': '100k - 200k',
  '200_500k': '200k - 500k',
  above_500k: 'Trên 500k',
};
const PRICE_OPTIONS = Object.keys(PRICE_LABELS) as PriceRangeCode[];

const STEP_LABELS = ['Vị trí', 'Thông tin', 'Ảnh', 'Xác nhận'];
const MAX_PHOTOS = 10;

/**
 * Screen (Add Restaurant) per build-prompts/07 — a single flat screen with
 * internal step state, not a nested sub-navigator (SelectLocation is the
 * only step genuinely pushed as its own screen; Upload Media's real
 * reusable unit, PhotoUploadGrid, is embedded inline here instead).
 *
 * Deliberate MVP scope-narrowing: opening hours, facilities, and menu
 * items are NOT collected in this flow — all three are optional on
 * `CreateRestaurantContributionRequest` and can be added later via edit
 * suggestions once the restaurant exists. Building three more full sub-forms
 * (7-day hours grid, facility multi-select, dynamic menu-item list) into an
 * already-large first pass felt disproportionate; the core submit ->
 * duplicate-check -> moderate -> publish/queue flow is what this screen
 * exists to prove out end-to-end.
 */
export function AddRestaurantScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState(0);

  const draftLocation = useAddRestaurantDraftStore((s) => s.selectedLocation);
  const clearDraftLocation = useAddRestaurantDraftStore((s) => s.clear);

  const [line, setLine] = useState('');
  const [ward, setWard] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryCode, setCategoryCode] = useState<RestaurantCategoryCode | null>(null);
  const [cuisineCodes, setCuisineCodes] = useState<CuisineCode[]>([]);
  const [priceRangeCode, setPriceRangeCode] = useState<PriceRangeCode | null>(null);
  const [phone, setPhone] = useState('');

  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidateDto[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createContribution = useCreateRestaurantContribution();

  function toggleCuisine(code: CuisineCode) {
    setCuisineCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  const canProceedFromLocation = draftLocation !== null && line.trim().length > 0 && district.trim().length > 0 && province.trim().length > 0;
  const canProceedFromInfo = name.trim().length >= 2 && categoryCode !== null;
  const canSubmit = photoIds.length > 0 && canProceedFromLocation && canProceedFromInfo && !createContribution.isPending;

  function buildRequestBody(duplicateConfirmed?: boolean): CreateRestaurantContributionRequest {
    return {
      name: name.trim(),
      description: description.trim() ? description.trim() : undefined,
      categoryCode: categoryCode!,
      priceRangeCode: priceRangeCode ?? undefined,
      phone: phone.trim() ? phone.trim() : undefined,
      address: {
        line: line.trim(),
        ward: ward.trim() ? ward.trim() : null,
        district: district.trim(),
        province: province.trim(),
      },
      location: { lat: draftLocation!.lat, lng: draftLocation!.lng },
      cuisineCodes: cuisineCodes.length > 0 ? cuisineCodes : undefined,
      photoIds,
      duplicateConfirmed,
    };
  }

  function handleSubmit(duplicateConfirmed?: boolean) {
    if (!canSubmit) return;
    setFormError(null);
    createContribution.mutate(buildRequestBody(duplicateConfirmed), {
      onSuccess: (result) => {
        clearDraftLocation();
        navigation.replace('SubmissionStatus', { contributionId: result.contributionId });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          const candidates = (error.body as unknown as { candidates?: DuplicateCandidateDto[] } | undefined)?.candidates ?? [];
          setDuplicateCandidates(candidates);
          return;
        }
        setFormError('Không thể gửi thông tin quán. Vui lòng thử lại.');
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.stepper}>
        {STEP_LABELS.map((label, index) => (
          <View key={label} style={styles.stepperItem}>
            <View style={[styles.stepDot, index <= step ? styles.stepDotActive : null]}>
              <Text style={[styles.stepDotText, index <= step ? styles.stepDotTextActive : null]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, index === step ? styles.stepLabelActive : null]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {step === 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Vị trí quán</Text>
            <Pressable style={styles.locationButton} onPress={() => navigation.navigate('SelectLocation')}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.locationButtonText}>
                {draftLocation ? `${draftLocation.lat.toFixed(6)}, ${draftLocation.lng.toFixed(6)}` : 'Chọn vị trí trên bản đồ'}
              </Text>
            </Pressable>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Địa chỉ *</Text>
            <TextInput style={styles.input} placeholder="Số nhà, tên đường" placeholderTextColor={colors.textTertiary} value={line} onChangeText={setLine} />
            <TextInput style={styles.input} placeholder="Phường/Xã (tùy chọn)" placeholderTextColor={colors.textTertiary} value={ward} onChangeText={setWard} />
            <TextInput style={styles.input} placeholder="Quận/Huyện" placeholderTextColor={colors.textTertiary} value={district} onChangeText={setDistrict} />
            <TextInput style={styles.input} placeholder="Tỉnh/Thành phố" placeholderTextColor={colors.textTertiary} value={province} onChangeText={setProvince} />
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={styles.sectionTitle}>Tên quán *</Text>
            <TextInput style={styles.input} placeholder="Tên quán ăn" placeholderTextColor={colors.textTertiary} value={name} onChangeText={setName} />

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Mô tả</Text>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Giới thiệu ngắn về quán..."
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Loại hình *</Text>
            <View style={styles.chipsRow}>
              {CATEGORY_OPTIONS.map((code) => (
                <Pressable
                  key={code}
                  style={[styles.chip, categoryCode === code ? styles.chipActive : null]}
                  onPress={() => setCategoryCode(code)}
                >
                  <Text style={[styles.chipText, categoryCode === code ? styles.chipTextActive : null]}>{CATEGORY_LABELS[code]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Món ăn</Text>
            <View style={styles.chipsRow}>
              {CUISINE_OPTIONS.map((code) => (
                <Pressable
                  key={code}
                  style={[styles.chip, cuisineCodes.includes(code) ? styles.chipActive : null]}
                  onPress={() => toggleCuisine(code)}
                >
                  <Text style={[styles.chipText, cuisineCodes.includes(code) ? styles.chipTextActive : null]}>{CUISINE_LABELS[code]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Mức giá</Text>
            <View style={styles.chipsRow}>
              {PRICE_OPTIONS.map((code) => (
                <Pressable
                  key={code}
                  style={[styles.chip, priceRangeCode === code ? styles.chipActive : null]}
                  onPress={() => setPriceRangeCode((prev) => (prev === code ? null : code))}
                >
                  <Text style={[styles.chipText, priceRangeCode === code ? styles.chipTextActive : null]}>{PRICE_LABELS[code]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="0901234567"
              placeholderTextColor={colors.textTertiary}
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={styles.sectionTitle}>Ảnh quán *</Text>
            <Text style={styles.hint}>Cần ít nhất 1 ảnh để gửi thông tin quán.</Text>
            <PhotoUploadGrid ownerType="restaurant" maxPhotos={MAX_PHOTOS} onPhotoIdsChange={setPhotoIds} />
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            {duplicateCandidates && duplicateCandidates.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Có thể quán này đã tồn tại</Text>
                <Text style={styles.hint}>Kiểm tra danh sách bên dưới trước khi tiếp tục.</Text>
                {duplicateCandidates.map((candidate) => (
                  <View key={candidate.id} style={styles.candidateRow}>
                    <Text style={styles.candidateName}>{candidate.name}</Text>
                    <Text style={styles.candidateAddress}>{candidate.fullAddressText}</Text>
                    <Text style={styles.candidateMeta}>Cách {Math.round(candidate.distanceMeters)}m</Text>
                  </View>
                ))}
                <Pressable style={styles.submitButton} onPress={() => handleSubmit(true)}>
                  <Text style={styles.submitButtonText}>Đây là quán khác, tiếp tục gửi</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setDuplicateCandidates(null)}>
                  <Text style={styles.secondaryButtonText}>Quay lại chỉnh sửa</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionTitle}>Xác nhận thông tin</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tên quán</Text>
                  <Text style={styles.summaryValue}>{name || '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Loại hình</Text>
                  <Text style={styles.summaryValue}>{categoryCode ? CATEGORY_LABELS[categoryCode] : '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Địa chỉ</Text>
                  <Text style={styles.summaryValue}>{[line, ward, district, province].filter(Boolean).join(', ') || '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ảnh</Text>
                  <Text style={styles.summaryValue}>{photoIds.length} ảnh</Text>
                </View>

                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <Pressable
                  style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
                  onPress={() => handleSubmit()}
                  disabled={!canSubmit}
                >
                  <Text style={styles.submitButtonText}>{createContribution.isPending ? 'Đang gửi...' : 'Gửi thông tin quán'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.navRow}>
        {step > 0 ? (
          <Pressable style={styles.navButton} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.navButtonText}>Quay lại</Text>
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
        {step < 3 ? (
          <Pressable
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              (step === 0 && !canProceedFromLocation) || (step === 1 && !canProceedFromInfo) || (step === 2 && photoIds.length === 0)
                ? styles.navButtonDisabled
                : null,
            ]}
            disabled={(step === 0 && !canProceedFromLocation) || (step === 1 && !canProceedFromInfo) || (step === 2 && photoIds.length === 0)}
            onPress={() => setStep((s) => s + 1)}
          >
            <Text style={styles.navButtonTextPrimary}>Tiếp tục</Text>
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    stepper: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
    stepperItem: { flex: 1, alignItems: 'center' },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    stepDotActive: { backgroundColor: colors.primary },
    stepDotText: { fontSize: 12, fontWeight: '700', color: colors.textTertiary },
    stepDotTextActive: { color: colors.onPrimary },
    stepLabel: { fontSize: 11, color: colors.textTertiary },
    stepLabelActive: { color: colors.primary, fontWeight: '700' },
    content: { flex: 1 },
    contentInner: { padding: 16, paddingBottom: 32 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    sectionTitleSpaced: { marginTop: 20, marginBottom: 8 },
    hint: { fontSize: 12, color: colors.textTertiary, marginBottom: 10, marginTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginTop: 8,
    },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      minHeight: 80,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 8,
    },
    locationButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: colors.onPrimary },
    candidateRow: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 10 },
    candidateName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    candidateAddress: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    candidateMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
    summaryRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
    summaryLabel: { fontSize: 12, color: colors.textTertiary },
    summaryValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
    formError: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center' },
    submitButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
    secondaryButton: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    secondaryButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
    navRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    navButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    navButtonPrimary: { backgroundColor: colors.primary, borderRadius: 10, marginLeft: 8 },
    navButtonDisabled: { opacity: 0.5 },
    navButtonText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    navButtonTextPrimary: { fontSize: 14, fontWeight: '700', color: colors.onPrimary },
  });
