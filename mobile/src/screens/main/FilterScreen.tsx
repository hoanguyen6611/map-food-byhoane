import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CuisineCode, FacilityType, PriceRangeCode } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { getFilterValues, useFilterStore, type FilterValues } from '../../store/filterStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'Filter'>;

const DISTANCE_MIN_KM = 0.5;
const DISTANCE_MAX_KM = 20;
const DISTANCE_STEP_KM = 0.5;
const DEFAULT_DISTANCE_KM = 3;

interface PriceBucket {
  code: PriceRangeCode;
  label: string;
  min: number;
  max?: number;
}

// Matches the `PriceRangeCode` buckets from packages/shared-types/src/restaurant.ts —
// a single-select chip row is simpler and more correct than a raw numeric
// slider since these buckets are discrete, non-overlapping VND ranges.
const PRICE_BUCKETS: PriceBucket[] = [
  { code: 'under_50k', label: 'Dưới 50k', min: 0, max: 50000 },
  { code: '50_100k', label: '50k - 100k', min: 50000, max: 100000 },
  { code: '100_200k', label: '100k - 200k', min: 100000, max: 200000 },
  { code: '200_500k', label: '200k - 500k', min: 200000, max: 500000 },
  { code: 'above_500k', label: 'Trên 500k', min: 500000, max: undefined },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

const FACILITY_LABELS: Record<FacilityType, string> = {
  wifi: 'Wifi',
  parking_car: 'Đậu ô tô',
  parking_motorbike: 'Đậu xe máy',
  air_conditioner: 'Máy lạnh',
  outdoor_seating: 'Ngoài trời',
  kid_friendly: 'Thân thiện trẻ em',
  pet_friendly: 'Cho thú cưng',
  card_payment: 'Thanh toán thẻ',
  private_room: 'Phòng riêng',
};
const FACILITY_OPTIONS = Object.keys(FACILITY_LABELS) as FacilityType[];

const CUISINE_LABELS: Record<CuisineCode, string> = {
  mon_viet: 'Món Việt',
  mon_han: 'Món Hàn',
  mon_nhat: 'Món Nhật',
  mon_chay: 'Món chay',
  mon_thai: 'Món Thái',
  mon_au: 'Món Âu',
};
const CUISINE_OPTIONS = Object.keys(CUISINE_LABELS) as CuisineCode[];

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * Screen 11 (Filter) per docs/04-screen-list.md. Presented as a modal-style
 * pushed screen on the existing native-stack (see MainStackNavigator's
 * `presentation: 'modal'` option for this route) rather than a true animated
 * bottom-sheet library — the codebase has no bottom-sheet dependency yet and
 * the module brief says not to add a new heavy one just for this; a modal
 * push gets the same "full-height sheet with close/apply" UX the spec calls
 * for with zero new dependencies.
 *
 * Local working state is seeded FROM the filter store on mount (so
 * re-opening Filter shows the currently-applied filters), and is only
 * committed back to the store on "Áp dụng" — "Xoá bộ lọc" clears both the
 * local state and the store immediately. Neither action is a no-op no-op:
 * both navigate back per the screen spec's "quay lại màn hình gọi Filter
 * với kết quả mới".
 */
export function FilterScreen({ navigation }: Props) {
  const [local, setLocal] = useState<FilterValues>(() => getFilterValues(useFilterStore.getState()));
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const selectedBucket = PRICE_BUCKETS.find(
    (bucket) => bucket.min === local.priceMin && bucket.max === local.priceMax,
  );

  function selectPriceBucket(bucket: PriceBucket) {
    setLocal((prev) => {
      const alreadySelected = selectedBucket?.code === bucket.code;
      if (alreadySelected) {
        return { ...prev, priceMin: undefined, priceMax: undefined };
      }
      return { ...prev, priceMin: bucket.min, priceMax: bucket.max };
    });
  }

  function toggleDistance() {
    setLocal((prev) => ({ ...prev, distanceKm: prev.distanceKm === undefined ? DEFAULT_DISTANCE_KM : undefined }));
  }

  function adjustDistance(deltaKm: number) {
    setLocal((prev) => {
      if (prev.distanceKm === undefined) return prev;
      const next = Math.min(DISTANCE_MAX_KM, Math.max(DISTANCE_MIN_KM, prev.distanceKm + deltaKm));
      return { ...prev, distanceKm: Math.round(next * 10) / 10 };
    });
  }

  function selectRating(rating: number) {
    setLocal((prev) => ({ ...prev, minRating: prev.minRating === rating ? undefined : rating }));
  }

  function toggleFacility(facility: FacilityType) {
    setLocal((prev) => ({ ...prev, facilities: toggleInArray(prev.facilities, facility) }));
  }

  function toggleCuisine(cuisine: CuisineCode) {
    setLocal((prev) => ({ ...prev, cuisine: toggleInArray(prev.cuisine, cuisine) }));
  }

  function handleClear() {
    useFilterStore.getState().clearFilters();
    navigation.goBack();
  }

  function handleApply() {
    useFilterStore.getState().setFilters(local);
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Khoảng cách</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Giới hạn khoảng cách</Text>
          <Switch value={local.distanceKm !== undefined} onValueChange={toggleDistance} />
        </View>
        {local.distanceKm !== undefined ? (
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => adjustDistance(-DISTANCE_STEP_KM)}
              disabled={local.distanceKm <= DISTANCE_MIN_KM}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{local.distanceKm.toFixed(1)} km</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => adjustDistance(DISTANCE_STEP_KM)}
              disabled={local.distanceKm >= DISTANCE_MAX_KM}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Mức giá</Text>
        <View style={styles.chipRow}>
          {PRICE_BUCKETS.map((bucket) => {
            const selected = selectedBucket?.code === bucket.code;
            return (
              <Pressable
                key={bucket.code}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => selectPriceBucket(bucket)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{bucket.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Đánh giá tối thiểu</Text>
        <View style={styles.chipRow}>
          {RATING_OPTIONS.map((rating) => {
            const selected = local.minRating === rating;
            return (
              <Pressable
                key={rating}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => selectRating(rating)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{rating}★+</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Đang mở cửa</Text>
          <Switch
            value={local.openNow ?? false}
            onValueChange={(value) => setLocal((prev) => ({ ...prev, openNow: value || undefined }))}
          />
        </View>

        <Text style={styles.sectionTitle}>Tiện ích</Text>
        <View style={styles.chipRow}>
          {FACILITY_OPTIONS.map((facility) => {
            const selected = local.facilities.includes(facility);
            return (
              <Pressable
                key={facility}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleFacility(facility)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {FACILITY_LABELS[facility]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Loại món</Text>
        <View style={styles.chipRow}>
          {CUISINE_OPTIONS.map((cuisine) => {
            const selected = local.cuisine.includes(cuisine);
            return (
              <Pressable
                key={cuisine}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleCuisine(cuisine)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{CUISINE_LABELS[cuisine]}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Xoá bộ lọc</Text>
        </Pressable>
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Áp dụng</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 32 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontSize: 14, color: colors.textPrimary },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    stepperButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonText: { fontSize: 18, fontWeight: '700', color: colors.primary },
    stepperValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, minWidth: 64, textAlign: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    chipTextSelected: { color: colors.primary },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    clearButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    clearButtonText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
    applyButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    applyButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
