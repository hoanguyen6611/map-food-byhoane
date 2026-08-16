import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, type Region } from 'react-native-maps';
// react-native-map-clustering wraps `react-native-maps`' MapView with
// client-side clustering (via `supercluster`) — see docs/07-tech-stack.md's
// map integration row. It forwards all MapViewProps plus clustering props,
// and still calls a passed `onRegionChangeComplete` through with the
// (region, details, markers) signature, which is all this screen needs.
import ClusteredMapView from 'react-native-map-clustering';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantsInBounds } from '../../hooks/useRestaurantsInBounds';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import {
  DEFAULT_REGION_DELTA,
  HCMC_CENTER,
  haversineDistanceMeters,
  regionToBounds,
  roundBounds,
  type BoundsBox,
  type LatLng,
} from '../../lib/geo';
import { RestaurantPreviewCard } from '../../components/map/RestaurantPreviewCard';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { getFilterValues, useFilterStore } from '../../store/filterStore';
import { PRICE_BUCKETS } from '../../lib/priceBuckets';
import { FONT_FAMILY } from '../../theme/fonts';

const RATING_QUICK_OPTIONS = [4, 4.5];

type Props = NativeStackScreenProps<MainStackParamList, 'Map'>;

// Debounce viewport-change events at least 500ms before refetching, per
// build-prompts/03 task 3 / the PRD's debounce requirement — a pan/zoom
// gesture can fire onRegionChangeComplete several times in quick succession
// during momentum scrolling, so we must not fire a request per event.
const REGION_CHANGE_DEBOUNCE_MS = 500;

// A short, fixed list of HCMC areas for the "chọn khu vực thủ công" picker.
// A full geocoding search is Module 4/5's job (docs/build-prompts/03 scope
// note) — this is intentionally a trivial placeholder.
const MANUAL_AREAS: { label: string; center: LatLng }[] = [
  { label: 'Trung tâm TP. Hồ Chí Minh (Quận 1)', center: HCMC_CENTER },
  { label: 'Quận 3', center: { latitude: 10.7843, longitude: 106.6875 } },
  { label: 'Bình Thạnh', center: { latitude: 10.8033, longitude: 106.7129 } },
];

/**
 * Map screen ("Ngon v3" reskin — moved off the tab bar, now reached via
 * Explore's "Mở bản đồ" button; see MainStackNavigator). Real
 * permission/location check + real bounds-driven map rendering (Module 3
 * scope) — none of that changed, only how this screen is reached. The
 * floating search bar navigates to the real Search screen (Module 4); the
 * quick filter chips (Mở cửa/Giá/Đánh giá) write into the same
 * `useFilterStore` that FilterScreen/SearchResultScreen read, then filter
 * the already-fetched bounds results CLIENT-SIDE — `/restaurants/bounds`
 * itself has no filter query params (only Search's `/search` endpoint does),
 * so this is the pragmatic way to make the map respect quick filters without
 * a backend change, consistent with `MANUAL_AREAS` below being an
 * intentionally lightweight MVP picker rather than a full geocoder. The "+"
 * FAB (build-prompts/07) pushes the real Add Restaurant flow.
 *
 * Note: `PermissionLocationScreen` (boot sequence, see RootNavigator) only
 * *requests* the OS permission once; it doesn't store or expose the result.
 * This screen independently checks the current permission/location state on
 * its own mount, as instructed.
 */
export function MapScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  // A plain safe-area clearance, not FLOATING_TAB_BAR_CLEARANCE — as a pushed
  // stack screen (not a tab), the floating tab bar is never visible behind
  // this screen, so there's nothing to clear.
  const floatingButtonBottom = insets.bottom + 16;
  const mapRef = useRef<MapView | null>(null);
  const regionChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [locationBannerVisible, setLocationBannerVisible] = useState(false);
  const [debouncedBounds, setDebouncedBounds] = useState<BoundsBox | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantSummaryDto | null>(null);

  // --- Task 2: real permission + location check on mount ------------------
  // Factored into `useDeviceLocation` (src/hooks/useDeviceLocation.ts) so
  // ListScreen (build-prompts/04) shares the same permission-check logic
  // instead of a second independent flow; this effect just derives the
  // screen-local `initialRegion`/banner state from the hook's result, same
  // as the original inline implementation did.
  const { location: deviceLocation, isResolved: locationResolved, isFallback: locationIsFallback } =
    useDeviceLocation();

  useEffect(() => {
    if (!locationResolved) return;
    const center = deviceLocation ?? HCMC_CENTER;
    setInitialRegion({ ...center, ...DEFAULT_REGION_DELTA });
    if (locationIsFallback) {
      // Denied, or the check/fix failed (e.g. GPS timeout) — fall back to
      // Ho Chi Minh City center + a dismissible banner, per screen 7's spec.
      setLocationBannerVisible(true);
    }
  }, [locationResolved, deviceLocation, locationIsFallback]);

  // Seed the first bounds fetch as soon as we know where to center, instead
  // of waiting for the user's first pan/zoom gesture.
  useEffect(() => {
    if (initialRegion) {
      setDebouncedBounds(roundBounds(regionToBounds(initialRegion)));
    }
  }, [initialRegion]);

  useEffect(() => {
    return () => {
      if (regionChangeTimer.current) {
        clearTimeout(regionChangeTimer.current);
      }
    };
  }, []);

  // --- Task 3: debounced viewport -> /restaurants/bounds -------------------
  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (regionChangeTimer.current) {
      clearTimeout(regionChangeTimer.current);
    }
    regionChangeTimer.current = setTimeout(() => {
      setDebouncedBounds(roundBounds(regionToBounds(region)));
    }, REGION_CHANGE_DEBOUNCE_MS);
  }, []);

  const restaurantsQuery = useRestaurantsInBounds(debouncedBounds);
  const restaurants = restaurantsQuery.data ?? [];
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const openNow = useFilterStore((state) => state.openNow);
  const priceMin = useFilterStore((state) => state.priceMin);
  const priceMax = useFilterStore((state) => state.priceMax);
  const minRating = useFilterStore((state) => state.minRating);
  const setFilters = useFilterStore((state) => state.setFilters);
  // getFilterValues builds a fresh object every call — without useShallow,
  // useSyncExternalStore sees a "new" snapshot on every render (never
  // reference-equal to the last one) and warns/can loop, since Zustand v5's
  // useStore no longer applies shallow-equality to object selectors itself.
  const filterValues = useFilterStore(useShallow(getFilterValues));

  const filteredRestaurants = restaurants.filter((restaurant) => {
    if (openNow && !restaurant.isOpenNow) return false;
    if (minRating !== undefined && (restaurant.compositeScore === null || restaurant.compositeScore < minRating)) {
      return false;
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      if (!restaurant.priceRange) return false;
      const rangeMin = restaurant.priceRange.minVnd;
      const rangeMax = restaurant.priceRange.maxVnd ?? Infinity;
      const filterMin = priceMin ?? 0;
      const filterMax = priceMax ?? Infinity;
      if (!(rangeMin < filterMax && rangeMax > filterMin)) return false;
    }
    return true;
  });

  const hasCachedData = restaurantsQuery.data !== undefined;
  const showInitialLoading = initialRegion === null || (restaurantsQuery.isLoading && !hasCachedData);
  const showOfflineBanner = restaurantsQuery.isError && hasCachedData;
  const showFullError = restaurantsQuery.isError && !hasCachedData;
  const showEmptyState =
    !showFullError &&
    restaurantsQuery.isSuccess &&
    !restaurantsQuery.isLoading &&
    (restaurants.length === 0 || filteredRestaurants.length === 0);

  function handleRecenter() {
    if (!deviceLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({ ...deviceLocation, ...DEFAULT_REGION_DELTA }, 400);
  }

  function handleManualAreaPicked(center: LatLng) {
    setLocationBannerVisible(false);
    mapRef.current?.animateToRegion({ ...center, ...DEFAULT_REGION_DELTA }, 400);
  }

  function openManualAreaPicker() {
    // Trivial MVP placeholder per build-prompts/03 scope note — a real
    // geocoding search/city-district picker is Module 4/5's job.
    Alert.alert(
      t('map.chooseAreaDialogTitle'),
      undefined,
      [
        ...MANUAL_AREAS.map((area) => ({ text: area.label, onPress: () => handleManualAreaPicked(area.center) })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }

  function toggleOpenNowChip() {
    setFilters({ ...filterValues, openNow: !openNow });
  }

  function openPriceQuickPicker() {
    Alert.alert(
      t('map.priceDialogTitle'),
      undefined,
      [
        ...PRICE_BUCKETS.map((bucket) => ({
          text: bucket.label,
          onPress: () => setFilters({ ...filterValues, priceMin: bucket.min, priceMax: bucket.max }),
        })),
        {
          text: t('map.priceDialogAll'),
          onPress: () => setFilters({ ...filterValues, priceMin: undefined, priceMax: undefined }),
        },
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }

  function openRatingQuickPicker() {
    Alert.alert(
      t('map.ratingDialogTitle'),
      undefined,
      [
        ...RATING_QUICK_OPTIONS.map((rating) => ({
          text: t('map.ratingDialogOption', { rating }),
          onPress: () => setFilters({ ...filterValues, minRating: rating }),
        })),
        { text: t('map.ratingDialogAll'), onPress: () => setFilters({ ...filterValues, minRating: undefined }) },
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }

  if (showInitialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('map.loading')}</Text>
      </View>
    );
  }

  if (showFullError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
        <Text style={styles.errorBody}>{t('map.errorBody')}</Text>
        <Pressable style={styles.retryButton} onPress={() => restaurantsQuery.refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ClusteredMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion ?? undefined}
        onRegionChangeComplete={handleRegionChangeComplete}
        clusteringEnabled
        clusterColor={colors.primary}
        clusterTextColor={colors.onPrimary}
        showsUserLocation={deviceLocation !== null}
        showsMyLocationButton={false}
      >
        {filteredRestaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
            onPress={() => setSelectedRestaurant(restaurant)}
            pinColor={colors.primary}
          />
        ))}
      </ClusteredMapView>

      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
          accessibilityRole="search"
          accessibilityLabel={t('map.searchPlaceholder')}
        >
          <Text style={styles.searchBarText}>{t('map.searchPlaceholder')}</Text>
        </Pressable>
        <View style={styles.quickChipRow}>
          <Pressable
            style={[styles.quickChip, openNow && styles.quickChipActive]}
            onPress={toggleOpenNowChip}
            accessibilityRole="button"
          >
            <Text style={[styles.quickChipText, openNow && styles.quickChipTextActive]}>{t('map.chipOpenNow')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickChip, (priceMin !== undefined || priceMax !== undefined) && styles.quickChipActive]}
            onPress={openPriceQuickPicker}
            accessibilityRole="button"
          >
            <Text style={[styles.quickChipText, (priceMin !== undefined || priceMax !== undefined) && styles.quickChipTextActive]}>
              {t('map.chipPrice')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.quickChip, minRating !== undefined && styles.quickChipActive]}
            onPress={openRatingQuickPicker}
            accessibilityRole="button"
          >
            <Text style={[styles.quickChipText, minRating !== undefined && styles.quickChipTextActive]}>{t('map.chipRating')}</Text>
          </Pressable>
        </View>
      </View>

      {restaurantsQuery.isFetching && hasCachedData ? (
        <View style={styles.refetchIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {locationBannerVisible ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('map.locationUnavailable')}</Text>
          <View style={styles.bannerActions}>
            <Pressable onPress={openManualAreaPicker}>
              <Text style={styles.bannerLink}>{t('map.chooseAreaManually')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setLocationBannerVisible(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('map.dismissNotification')}
            >
              <Text style={styles.bannerDismiss}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showOfflineBanner ? (
        <View style={[styles.banner, locationBannerVisible && styles.bannerStacked]}>
          <Text style={styles.bannerText}>{t('map.offlineBanner')}</Text>
        </View>
      ) : null}

      {showEmptyState ? (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={styles.emptyStateTitle}>{t('map.emptyTitle')}</Text>
          <Text style={styles.emptyStateHint}>
            {restaurants.length > 0 ? t('map.emptyHintFiltered') : t('map.emptyHintNoData')}
          </Text>
        </View>
      ) : null}

      {deviceLocation ? (
        <Pressable
          style={[styles.recenterButton, { bottom: floatingButtonBottom }]}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
        >
          <Text style={styles.recenterButtonText}>◎</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.fab, { bottom: floatingButtonBottom }]}
        onPress={() => navigation.navigate('AddRestaurant')}
        accessibilityRole="button"
        accessibilityLabel={t('map.addRestaurant')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {selectedRestaurant ? (
        <RestaurantPreviewCard
          restaurant={selectedRestaurant}
          distanceMeters={
            selectedRestaurant.distanceMeters ??
            (deviceLocation
              ? haversineDistanceMeters(deviceLocation, {
                  latitude: selectedRestaurant.lat,
                  longitude: selectedRestaurant.lng,
                })
              : null)
          }
          onClose={() => setSelectedRestaurant(null)}
          onViewDetail={() => {
            const restaurantId = selectedRestaurant.id;
            setSelectedRestaurant(null);
            navigation.navigate('RestaurantDetail', { restaurantId });
          }}
          isFavorited={favoriteIdsQuery.data?.has(selectedRestaurant.id) ?? false}
          onToggleFavorite={() =>
            toggleFavorite.mutate({
              restaurantId: selectedRestaurant.id,
              isFavorited: favoriteIdsQuery.data?.has(selectedRestaurant.id) ?? false,
            })
          }
        />
      ) : null}
    </View>
  );
}

// Height reserved by `topBar` (search pill + quick-chip row) below the safe
// area — banners/refetch-indicator are pushed below this so they never
// overlap the floating search bar.
const TOP_BAR_OFFSET = (Platform.OS === 'ios' ? 56 : 16) + 96;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
    topBar: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 16,
      left: 16,
      right: 16,
    },
    searchBar: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 13,
      paddingHorizontal: 18,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
    searchBarText: { color: colors.textTertiary, fontSize: 14, fontFamily: FONT_FAMILY.body },
    quickChipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    quickChip: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 6,
      paddingHorizontal: 14,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    quickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    quickChipText: { color: colors.textPrimary, fontSize: 13, fontFamily: FONT_FAMILY.bodySemiBold },
    quickChipTextActive: { color: colors.onPrimary },
    refetchIndicator: {
      position: 'absolute',
      top: TOP_BAR_OFFSET,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
    },
    banner: {
      position: 'absolute',
      top: TOP_BAR_OFFSET,
      left: 16,
      right: 16,
      backgroundColor: colors.overlayBanner,
      borderRadius: 14,
      padding: 12,
    },
    bannerStacked: { top: TOP_BAR_OFFSET + 68 },
    bannerText: { color: colors.overlayBannerText, fontSize: 13 },
    bannerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    bannerLink: { color: colors.overlayBannerLink, fontWeight: '700', fontSize: 13 },
    bannerDismiss: { color: colors.overlayBannerText, fontSize: 14, fontWeight: '700', paddingHorizontal: 4 },
    emptyState: {
      position: 'absolute',
      top: '40%',
      left: 32,
      right: 32,
      alignItems: 'center',
    },
    // Deliberately theme-invariant (white-translucent-on-map), same rationale
    // as `overlayBanner`: this is a floating label over the MAP TILES (which
    // this module explicitly doesn't re-theme), not part of the app's normal
    // reading surface — flipping it dark would fight the light map beneath it.
    emptyStateTitle: {
      fontSize: 15,
      fontFamily: FONT_FAMILY.bodyBold,
      color: '#333',
      textAlign: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      overflow: 'hidden',
    },
    emptyStateHint: {
      fontSize: 13,
      color: '#555',
      textAlign: 'center',
      marginTop: 6,
      backgroundColor: 'rgba(255,255,255,0.9)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      overflow: 'hidden',
    },
    recenterButton: {
      // `bottom` is overridden inline with the floating-tab-bar clearance.
      position: 'absolute',
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    recenterButtonText: { fontSize: 20, color: colors.primary },
    fab: {
      // `bottom` is overridden inline with the floating-tab-bar clearance.
      position: 'absolute',
      left: 16,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
    },
    fabText: { fontSize: 28, color: colors.onPrimary, fontWeight: '400', marginTop: -2 },
  });
