import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantDetail } from '../../hooks/useRestaurantDetail';
import { useAuthStore } from '../../store/authStore';
import { formatPriceRange } from '../../lib/format';
import { CATEGORY_LABELS, DAY_LABELS, FACILITY_META, formatVndFull } from '../../lib/restaurantLabels';
import { ApiError } from '../../api/client';

type Props = NativeStackScreenProps<MainStackParamList, 'RestaurantDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 240;
const MENU_PREVIEW_COUNT = 3;

/**
 * Screen 11 (Restaurant Detail) per docs/04-screen-list.md /
 * docs/build-prompts/05-restaurant-detail-admin-seed.md. Reviews and AI
 * summary sections intentionally render honest "not available yet" copy —
 * `reviewCount`/`aiSummary` are always 0/null until build-prompts/06 and 07
 * ship, per the DTO's own contract comment.
 */
export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const detailQuery = useRestaurantDetail(restaurantId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [carouselIndex, setCarouselIndex] = useState(0);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#e4572e" />
        <Text style={styles.loadingText}>Đang tải thông tin quán...</Text>
      </View>
    );
  }

  if (detailQuery.isError) {
    const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{isNotFound ? 'Không tìm thấy quán' : 'Không có kết nối'}</Text>
        <Text style={styles.errorBody}>
          {isNotFound
            ? 'Quán này không tồn tại hoặc đã ngừng hoạt động.'
            : 'Không thể tải thông tin quán ăn. Vui lòng thử lại.'}
        </Text>
        {!isNotFound ? (
          <Pressable style={styles.retryButton} onPress={() => detailQuery.refetch()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const restaurant = detailQuery.data;
  if (!restaurant) {
    return null;
  }

  const priceLabel = formatPriceRange(restaurant.priceRange);
  const firstMenu = restaurant.menus[0];
  const previewItems = firstMenu?.items.slice(0, MENU_PREVIEW_COUNT) ?? [];
  const hasAnyMenuItems = restaurant.menus.some((menu) => menu.items.length > 0);

  function handleCarouselScroll(event: { nativeEvent: { contentOffset: { x: number } } }) {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCarouselIndex(index);
  }

  function handleDirections() {
    // `restaurant` is checked non-null above, but TS doesn't carry that
    // narrowing into these hoisted function declarations — asserted here.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${restaurant!.location.lat},${restaurant!.location.lng}`;
    Linking.openURL(url);
  }

  function handleReport() {
    Alert.alert('Sắp ra mắt', 'Tính năng báo cáo sẽ sớm được ra mắt.');
  }

  // No-op: intentionally disabled. There is no Favorites backend endpoint
  // yet (that's build-prompts/08's scope) — wiring this up now would just
  // mean every tap 404s, so we render an honest "coming soon" state instead
  // of a button that appears to work but silently fails.
  function handleFavoritePress() {}

  function handleCall() {
    if (restaurant!.phone) {
      Linking.openURL(`tel:${restaurant!.phone}`);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* --- Photo carousel --- */}
      {restaurant.photos.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleCarouselScroll}
          >
            {restaurant.photos.map((photo) => (
              <View key={photo.id} style={{ width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT }}>
                <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </View>
            ))}
          </ScrollView>
          {restaurant.photos.length > 1 ? (
            <View style={styles.carouselDots}>
              {restaurant.photos.map((photo, index) => (
                <View
                  key={photo.id}
                  style={[styles.carouselDot, index === carouselIndex ? styles.carouselDotActive : null]}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.noPhotoPlaceholder}>
          <Ionicons name="image-outline" size={36} color="#bbb" />
          <Text style={styles.noPhotoText}>Chưa có ảnh</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* --- Name / category / price --- */}
        <Text style={styles.name}>{restaurant.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[restaurant.categoryCode]}</Text>
          {priceLabel ? <Text style={styles.separatorDot}> · </Text> : null}
          {priceLabel ? <Text style={styles.priceText}>{priceLabel}đ</Text> : null}
        </View>

        {/* --- Rating: honestly empty until build-prompts/06 --- */}
        <View style={styles.section}>
          <Text style={styles.ratingText}>
            {restaurant.reviewCount > 0
              ? `★ ${restaurant.compositeScore?.toFixed(1) ?? '—'} (${restaurant.reviewCount})`
              : 'Chưa có đánh giá'}
          </Text>
        </View>

        {/* --- Address + map --- */}
        <View style={styles.section}>
          <View style={styles.rowStart}>
            <Ionicons name="location-outline" size={18} color="#666" style={styles.rowIcon} />
            <Text style={styles.addressText}>{restaurant.address.fullAddressText}</Text>
          </View>
          <View style={styles.mapContainer}>
            <MapView
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              pointerEvents="none"
              initialRegion={{
                latitude: restaurant.location.lat,
                longitude: restaurant.location.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={{ latitude: restaurant.location.lat, longitude: restaurant.location.lng }} />
            </MapView>
          </View>
        </View>

        {/* --- Phone --- */}
        {restaurant.phone ? (
          <Pressable style={[styles.section, styles.rowStart]} onPress={handleCall}>
            <Ionicons name="call-outline" size={18} color="#666" style={styles.rowIcon} />
            <Text style={styles.phoneText}>{restaurant.phone}</Text>
          </Pressable>
        ) : null}

        {/* --- Opening hours --- */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Giờ mở cửa</Text>
            <View style={[styles.badge, restaurant.isOpenNow ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={styles.badgeText}>{restaurant.isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}</Text>
            </View>
          </View>
          {[...restaurant.openingHours]
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((hour) => (
              <View key={hour.dayOfWeek} style={styles.hourRow}>
                <Text style={styles.hourDay}>{DAY_LABELS[hour.dayOfWeek]}</Text>
                <Text style={styles.hourTime}>
                  {hour.isClosed ? 'Đóng cửa' : `${hour.openTime} - ${hour.closeTime}`}
                </Text>
              </View>
            ))}
        </View>

        {/* --- Facilities --- */}
        {restaurant.facilities.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiện ích</Text>
            <View style={styles.facilitiesGrid}>
              {restaurant.facilities.map((facility) => {
                const meta = FACILITY_META[facility];
                return (
                  <View key={facility} style={styles.facilityItem}>
                    <Ionicons name={meta.icon} size={18} color="#e4572e" />
                    <Text style={styles.facilityLabel}>{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* --- Menu preview --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thực đơn</Text>
          {!hasAnyMenuItems ? (
            <Text style={styles.emptyInlineText}>Chưa có thực đơn</Text>
          ) : (
            <>
              {previewItems.map((item) => (
                <View key={item.id} style={styles.menuRow}>
                  <Text style={styles.menuItemName} numberOfLines={1}>
                    {item.name}
                    {item.isPopular ? ' 🔥' : ''}
                  </Text>
                  <Text style={styles.menuItemPrice}>{formatVndFull(item.priceVnd)}</Text>
                </View>
              ))}
              <Pressable onPress={() => navigation.navigate('Menu', { restaurantId })}>
                <Text style={styles.linkText}>Xem toàn bộ thực đơn</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* --- Photos link --- */}
        <Pressable
          style={styles.section}
          onPress={() => navigation.navigate('PhotoGallery', { restaurantId })}
        >
          <Text style={styles.linkText}>
            Xem tất cả ảnh {restaurant.photos.length > 0 ? `(${restaurant.photos.length})` : ''}
          </Text>
        </Pressable>

        {/* --- AI summary: static pending state, no AI endpoint exists yet --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tóm tắt AI</Text>
          <Text style={styles.emptyInlineText}>AI chưa đủ dữ liệu để tóm tắt quán này</Text>
        </View>

        {/* --- Action buttons --- */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionButton, styles.actionButtonDisabled]}
            onPress={handleFavoritePress}
            disabled
          >
            <Ionicons name="heart-outline" size={18} color="#999" />
            <Text style={styles.actionButtonTextDisabled}>Sắp ra mắt</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleDirections}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Chỉ đường</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.actionButtonOutline]} onPress={handleReport}>
            <Ionicons name="flag-outline" size={18} color="#a94442" />
            <Text style={styles.actionButtonTextOutline}>Báo cáo</Text>
          </Pressable>
        </View>

        {!isAuthenticated ? (
          <Text style={styles.authHint}>Đăng nhập để lưu quán yêu thích và viết đánh giá.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 32 },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
  },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#a94442', marginBottom: 8 },
  errorBody: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#e4572e', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
  noPhotoPlaceholder: {
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noPhotoText: { color: '#999', fontSize: 14, fontWeight: '600' },
  carouselDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  carouselDotActive: { backgroundColor: '#fff', width: 8, height: 8, borderRadius: 4 },
  body: { padding: 16 },
  name: { fontSize: 22, fontWeight: '800', color: '#222', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryText: { fontSize: 14, color: '#666', fontWeight: '600' },
  separatorDot: { fontSize: 13, color: '#bbb' },
  priceText: { fontSize: 14, color: '#444', fontWeight: '600' },
  ratingText: { fontSize: 14, color: '#888' },
  section: { marginTop: 18 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 8 },
  rowStart: { flexDirection: 'row', alignItems: 'flex-start' },
  rowIcon: { marginRight: 8, marginTop: 1 },
  addressText: { flex: 1, fontSize: 14, color: '#444', lineHeight: 20 },
  phoneText: { fontSize: 14, color: '#1e6fd9', fontWeight: '600' },
  mapContainer: { height: 140, borderRadius: 10, overflow: 'hidden', marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeOpen: { backgroundColor: '#e3f6e8' },
  badgeClosed: { backgroundColor: '#f6e3e3' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#333' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  hourDay: { fontSize: 13, color: '#666' },
  hourTime: { fontSize: 13, color: '#333', fontWeight: '600' },
  facilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  facilityItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
  facilityLabel: { fontSize: 13, color: '#444' },
  emptyInlineText: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  menuItemName: { fontSize: 14, color: '#333', flex: 1, marginRight: 8 },
  menuItemPrice: { fontSize: 14, color: '#e4572e', fontWeight: '700' },
  linkText: { fontSize: 14, color: '#1e6fd9', fontWeight: '700', marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e4572e',
    borderRadius: 10,
    paddingVertical: 12,
  },
  actionButtonDisabled: { backgroundColor: '#f2f2f2' },
  actionButtonOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#a94442' },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionButtonTextDisabled: { color: '#999', fontWeight: '700', fontSize: 13 },
  actionButtonTextOutline: { color: '#a94442', fontWeight: '700', fontSize: 13 },
  authHint: { marginTop: 14, fontSize: 12, color: '#999', textAlign: 'center' },
});
