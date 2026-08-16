import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { CuisineCode, FacilityType } from '@foodmap/shared-types';
import { VN_PROVINCES, findVnProvinceByName } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { PRICE_BUCKETS, type PriceBucket } from '../../lib/priceBuckets';
import { getFilterValues, useFilterStore, type FilterValues } from '../../store/filterStore';
import { SearchableSelectModal } from '../../components/SearchableSelectModal';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';

type Props = NativeStackScreenProps<MainStackParamList, 'Filter'>;

const DISTANCE_MIN_KM = 0.5;
const DISTANCE_MAX_KM = 20;
const DISTANCE_STEP_KM = 0.5;
const DEFAULT_DISTANCE_KM = 3;

const RATING_OPTIONS = [1, 2, 3, 4, 5];

const FACILITY_LABEL_KEYS: Record<FacilityType, string> = {
  wifi: 'filter.facilityWifi',
  parking_car: 'filter.facilityParkingCar',
  parking_motorbike: 'filter.facilityParkingMotorbike',
  air_conditioner: 'filter.facilityAirConditioner',
  outdoor_seating: 'filter.facilityOutdoorSeating',
  kid_friendly: 'filter.facilityKidFriendly',
  pet_friendly: 'filter.facilityPetFriendly',
  card_payment: 'filter.facilityCardPayment',
  private_room: 'filter.facilityPrivateRoom',
};
const FACILITY_OPTIONS = Object.keys(FACILITY_LABEL_KEYS) as FacilityType[];

const CUISINE_LABEL_KEYS: Record<CuisineCode, string> = {
  mon_viet: 'filter.cuisineMonViet',
  mon_han: 'filter.cuisineMonHan',
  mon_nhat: 'filter.cuisineMonNhat',
  mon_chay: 'filter.cuisineMonChay',
  mon_thai: 'filter.cuisineMonThai',
  mon_au: 'filter.cuisineMonAu',
};
const CUISINE_OPTIONS = Object.keys(CUISINE_LABEL_KEYS) as CuisineCode[];

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
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [isProvincePickerOpen, setProvincePickerOpen] = useState(false);
  const [isWardPickerOpen, setWardPickerOpen] = useState(false);

  // `local.province`/`local.ward` store the official dataset name (what
  // actually gets sent to the API) — derive the VnProvince record back from
  // it purely to build the Ward picker's option list and to know when a
  // province is currently selected. Same code/name split as AddRestaurantScreen.
  const selectedProvince = local.province ? findVnProvinceByName(local.province) : undefined;

  function selectProvince(code: string) {
    const found = VN_PROVINCES.find((p) => p.code === code);
    if (!found) return;
    // Previously chosen ward belongs to the old province — clear it.
    setLocal((prev) => ({ ...prev, province: found.name, ward: undefined }));
  }

  function selectWard(code: string) {
    const found = selectedProvince?.wards.find((w) => w.code === code);
    if (!found) return;
    setLocal((prev) => ({ ...prev, ward: found.name }));
  }

  function clearArea() {
    setLocal((prev) => ({ ...prev, province: undefined, ward: undefined }));
  }

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
        <Text style={styles.sectionTitle}>{t('filter.distance')}</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>{t('filter.limitDistance')}</Text>
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

        <Text style={styles.sectionTitle}>{t('filter.price')}</Text>
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

        <Text style={styles.sectionTitle}>{t('filter.minRating')}</Text>
        <View style={styles.chipRow}>
          {RATING_OPTIONS.map((rating) => {
            const selected = local.minRating === rating;
            return (
              <Pressable
                key={rating}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => selectRating(rating)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t('filter.ratingOption', { rating })}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>{t('filter.openNow')}</Text>
          <Switch
            value={local.openNow ?? false}
            onValueChange={(value) => setLocal((prev) => ({ ...prev, openNow: value || undefined }))}
          />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>{t('filter.area')}</Text>
          {local.province ? (
            <Pressable onPress={clearArea} hitSlop={8}>
              <Text style={styles.clearAreaText}>{t('filter.clear')}</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable style={styles.selectField} onPress={() => setProvincePickerOpen(true)}>
          <Text style={[styles.selectFieldText, !local.province ? styles.selectFieldPlaceholder : null]}>
            {selectedProvince ? selectedProvince.shortName : t('filter.chooseProvince')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.selectField, !selectedProvince ? styles.selectFieldDisabled : null]}
          disabled={!selectedProvince}
          onPress={() => setWardPickerOpen(true)}
        >
          <Text style={[styles.selectFieldText, !local.ward ? styles.selectFieldPlaceholder : null]}>
            {local.ward
              ? (selectedProvince?.wards.find((w) => w.name === local.ward)?.shortName ?? local.ward)
              : selectedProvince
                ? t('filter.chooseWard')
                : t('filter.chooseProvinceFirst')}
          </Text>
        </Pressable>

        <SearchableSelectModal
          visible={isProvincePickerOpen}
          title={t('filter.chooseProvince')}
          options={VN_PROVINCES.map((p) => ({ code: p.code, label: p.shortName }))}
          selectedCode={selectedProvince?.code}
          onSelect={(option) => selectProvince(option.code)}
          onClose={() => setProvincePickerOpen(false)}
        />

        <SearchableSelectModal
          visible={isWardPickerOpen}
          title={t('filter.chooseWard')}
          options={(selectedProvince?.wards ?? []).map((w) => ({ code: w.code, label: w.shortName }))}
          selectedCode={selectedProvince?.wards.find((w) => w.name === local.ward)?.code}
          onSelect={(option) => selectWard(option.code)}
          onClose={() => setWardPickerOpen(false)}
        />

        <Text style={styles.sectionTitle}>{t('filter.facilities')}</Text>
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
                  {t(FACILITY_LABEL_KEYS[facility])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('filter.cuisine')}</Text>
        <View style={styles.chipRow}>
          {CUISINE_OPTIONS.map((cuisine) => {
            const selected = local.cuisine.includes(cuisine);
            return (
              <Pressable
                key={cuisine}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleCuisine(cuisine)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(CUISINE_LABEL_KEYS[cuisine])}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>{t('filter.clearAll')}</Text>
        </Pressable>
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>{t('filter.apply')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 32 },
    sectionTitle: { fontSize: 14, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontSize: 14, color: colors.textPrimary, fontFamily: FONT_FAMILY.body },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    stepperButton: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonText: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.primary },
    stepperValue: {
      fontSize: 15,
      fontFamily: FONT_FAMILY.bodySemiBold,
      color: colors.textPrimary,
      minWidth: 64,
      textAlign: 'center',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: FONT_FAMILY.bodySemiBold },
    chipTextSelected: { color: colors.primary },
    clearAreaText: { fontSize: 13, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.primary },
    selectField: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      marginTop: 8,
    },
    selectFieldDisabled: { opacity: 0.5 },
    selectFieldText: { fontSize: 14, color: colors.textPrimary, fontFamily: FONT_FAMILY.body },
    selectFieldPlaceholder: { color: colors.textTertiary },
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
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    clearButtonText: { color: colors.primary, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 15 },
    applyButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    applyButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 15 },
  });
