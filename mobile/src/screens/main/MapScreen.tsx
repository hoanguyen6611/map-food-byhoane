import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
// react-native-map-clustering wraps `react-native-maps`' MapView with
// client-side clustering (via `supercluster`) — see docs/07-tech-stack.md's
// map integration row. It forwards all MapViewProps plus clustering props,
// and still calls a passed `onRegionChangeComplete` through with the
// (region, details, markers) signature, which is all this screen needs.
import ClusteredMapView from 'react-native-map-clustering';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
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

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Map'>,
  NativeStackScreenProps<MainStackParamList>
>;

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
 * Screen 7 (Home Map) per docs/04-screen-list.md. Real permission/location
 * check + real bounds-driven map rendering (Module 3 scope) — search bar,
 * filter chips, and the "+" FAB are explicitly out of scope (Modules 4/6/7).
 *
 * Note: `PermissionLocationScreen` (boot sequence, see RootNavigator) only
 * *requests* the OS permission once; it doesn't store or expose the result.
 * This screen independently checks the current permission/location state on
 * its own mount, as instructed.
 */
export function MapScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

  const hasCachedData = restaurantsQuery.data !== undefined;
  const showInitialLoading = initialRegion === null || (restaurantsQuery.isLoading && !hasCachedData);
  const showOfflineBanner = restaurantsQuery.isError && hasCachedData;
  const showFullError = restaurantsQuery.isError && !hasCachedData;
  const showEmptyState =
    !showFullError && restaurantsQuery.isSuccess && !restaurantsQuery.isLoading && restaurants.length === 0;

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
      'Chọn khu vực',
      undefined,
      [
        ...MANUAL_AREAS.map((area) => ({ text: area.label, onPress: () => handleManualAreaPicked(area.center) })),
        { text: 'Huỷ', style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }

  if (showInitialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
      </View>
    );
  }

  if (showFullError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Không có kết nối</Text>
        <Text style={styles.errorBody}>Không thể tải danh sách quán ăn. Vui lòng thử lại.</Text>
        <Pressable style={styles.retryButton} onPress={() => restaurantsQuery.refetch()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
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
        showsUserLocation={deviceLocation !== null}
        showsMyLocationButton={false}
      >
        {restaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
            onPress={() => setSelectedRestaurant(restaurant)}
          />
        ))}
      </ClusteredMapView>

      {restaurantsQuery.isFetching && hasCachedData ? (
        <View style={styles.refetchIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {locationBannerVisible ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Không thể xác định vị trí của bạn — hiển thị khu vực TP. Hồ Chí Minh.
          </Text>
          <View style={styles.bannerActions}>
            <Pressable onPress={openManualAreaPicker}>
              <Text style={styles.bannerLink}>Chọn khu vực thủ công</Text>
            </Pressable>
            <Pressable
              onPress={() => setLocationBannerVisible(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo"
            >
              <Text style={styles.bannerDismiss}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showOfflineBanner ? (
        <View style={[styles.banner, locationBannerVisible && styles.bannerStacked]}>
          <Text style={styles.bannerText}>Không có kết nối — hiển thị dữ liệu đã lưu</Text>
        </View>
      ) : null}

      {showEmptyState ? (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={styles.emptyStateTitle}>Không có quán nào trong khu vực này</Text>
          <Text style={styles.emptyStateHint}>Thử thu nhỏ hoặc di chuyển bản đồ để xem khu vực khác</Text>
        </View>
      ) : null}

      {deviceLocation ? (
        <Pressable
          style={styles.recenterButton}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="Về vị trí của tôi"
        >
          <Text style={styles.recenterButtonText}>◎</Text>
        </Pressable>
      ) : null}

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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    refetchIndicator: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 16,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
    },
    banner: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 16,
      left: 16,
      right: 16,
      backgroundColor: colors.overlayBanner,
      borderRadius: 10,
      padding: 12,
    },
    bannerStacked: { top: (Platform.OS === 'ios' ? 56 : 16) + 68 },
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
      fontWeight: '700',
      color: '#333',
      textAlign: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
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
      borderRadius: 8,
      overflow: 'hidden',
    },
    recenterButton: {
      position: 'absolute',
      right: 16,
      bottom: 24,
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
  });
