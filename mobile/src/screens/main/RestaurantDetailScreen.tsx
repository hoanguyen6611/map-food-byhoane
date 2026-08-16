import { useState } from 'react';
import {
  ActivityIndicator,
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
import { useTranslation } from 'react-i18next';
import MapView, { Marker } from 'react-native-maps';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantDetail } from '../../hooks/useRestaurantDetail';
import { useAiSummary } from '../../hooks/useAiSummary';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useAuthStore } from '../../store/authStore';
import { formatPriceRange } from '../../lib/format';
import { CATEGORY_LABELS, DAY_LABELS, FACILITY_META, formatVndFull } from '../../lib/restaurantLabels';
import { ApiError } from '../../api/client';
import { ReviewCard } from '../../components/ReviewCard';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';

type Props = NativeStackScreenProps<MainStackParamList, 'RestaurantDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 240;
const MENU_PREVIEW_COUNT = 3;

/**
 * Screen 11 (Restaurant Detail) per docs/04-screen-list.md /
 * docs/build-prompts/05-restaurant-detail-admin-seed.md. The rating/reviews
 * section is wired to the real `reviews[]` preview + `compositeScore` per
 * build-prompts/06 (still honestly "Chưa có đánh giá" when `reviewCount` is
 * 0 — some restaurants genuinely have none). AI summary (US-J1/J2,
 * build-prompts/07) is read-side only — no real Claude summarize() call
 * exists yet, so `available: false` is a normal, honest response (no fake
 * "generating..." state), and whenever a summary IS available it always
 * renders the "Nội dung do AI tạo" label per the PRD's AI-labeling rule.
 */
export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const detailQuery = useRestaurantDetail(restaurantId);
  const aiSummaryQuery = useAiSummary(restaurantId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorited = favoriteIdsQuery.data?.has(restaurantId) ?? false;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('restaurantDetail.loading')}</Text>
      </View>
    );
  }

  if (detailQuery.isError) {
    const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{isNotFound ? t('restaurantDetail.notFoundTitle') : t('restaurantDetail.errorTitle')}</Text>
        <Text style={styles.errorBody}>
          {isNotFound ? t('restaurantDetail.notFoundBody') : t('restaurantDetail.errorBody')}
        </Text>
        {!isNotFound ? (
          <Pressable style={styles.retryButton} onPress={() => detailQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
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
    navigation.navigate('ReportContent', { targetType: 'restaurant', targetId: restaurantId });
  }

  // RootNavigator only ever mounts MainStack (where this screen lives) when
  // `isAuthenticated` is true, so this screen is never reached by a guest in
  // the current architecture — the favorite toggle can be wired
  // unconditionally (build-prompts/08).
  function handleFavoritePress() {
    toggleFavorite.mutate({ restaurantId, isFavorited });
  }

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
          <Ionicons name="image-outline" size={36} color={colors.textTertiary} />
          <Text style={styles.noPhotoText}>{t('restaurantDetail.noPhoto')}</Text>
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

        {/* --- Rating + review preview (build-prompts/06) --- */}
        <View style={styles.section}>
          <View style={styles.ratingHeaderRow}>
            <Text style={styles.ratingText}>
              {restaurant.reviewCount > 0
                ? t('restaurantDetail.ratingSummary', {
                    score: restaurant.compositeScore?.toFixed(1) ?? '—',
                    count: restaurant.reviewCount,
                  })
                : t('restaurantDetail.noRating')}
            </Text>
            <Pressable onPress={() => navigation.navigate('WriteReview', { restaurantId })}>
              <Text style={styles.linkText}>{t('restaurantDetail.writeReview')}</Text>
            </Pressable>
          </View>
          {restaurant.reviewCount > 0 ? (
            <>
              {restaurant.reviews.slice(0, 3).map((review) => (
                <ReviewCard key={review.id} review={review} compact />
              ))}
              <Pressable onPress={() => navigation.navigate('Reviews', { restaurantId })}>
                <Text style={styles.linkText}>{t('restaurantDetail.seeAllReviews')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* --- Address + map --- */}
        <View style={styles.section}>
          <View style={styles.rowStart}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
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
            <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={styles.phoneText}>{restaurant.phone}</Text>
          </Pressable>
        ) : null}

        {/* --- Opening hours --- */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('restaurantDetail.openingHours')}</Text>
            <View style={[styles.badge, restaurant.isOpenNow ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={styles.badgeText}>{restaurant.isOpenNow ? t('restaurantDetail.openNow') : t('restaurantDetail.closedNow')}</Text>
            </View>
          </View>
          {[...restaurant.openingHours]
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((hour) => (
              <View key={hour.dayOfWeek} style={styles.hourRow}>
                <Text style={styles.hourDay}>{DAY_LABELS[hour.dayOfWeek]}</Text>
                <Text style={styles.hourTime}>
                  {hour.isClosed ? t('restaurantDetail.closedDay') : `${hour.openTime} - ${hour.closeTime}`}
                </Text>
              </View>
            ))}
        </View>

        {/* --- Facilities --- */}
        {restaurant.facilities.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('restaurantDetail.facilities')}</Text>
            <View style={styles.facilitiesGrid}>
              {restaurant.facilities.map((facility) => {
                const meta = FACILITY_META[facility];
                return (
                  <View key={facility} style={styles.facilityItem}>
                    <Ionicons name={meta.icon} size={18} color={colors.primary} />
                    <Text style={styles.facilityLabel}>{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* --- Menu preview --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurantDetail.menu')}</Text>
          {!hasAnyMenuItems ? (
            <Text style={styles.emptyInlineText}>{t('restaurantDetail.noMenu')}</Text>
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
                <Text style={styles.linkText}>{t('restaurantDetail.seeFullMenu')}</Text>
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
            {restaurant.photos.length > 0
              ? t('restaurantDetail.seeAllPhotosWithCount', { count: restaurant.photos.length })
              : t('restaurantDetail.seeAllPhotos')}
          </Text>
        </Pressable>

        {/* --- AI summary (US-J1/J2) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurantDetail.aiSummaryTitle')}</Text>
          {aiSummaryQuery.data?.available && aiSummaryQuery.data.summary ? (
            <>
              <View style={styles.aiLabelBadge}>
                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                <Text style={styles.aiLabelBadgeText}>{t('restaurantDetail.aiGeneratedLabel')}</Text>
              </View>
              <Text style={styles.aiSummaryText}>{aiSummaryQuery.data.summary.summaryText}</Text>
              {aiSummaryQuery.data.summary.pros.length > 0 ? (
                <View style={styles.aiProsConsBlock}>
                  <Text style={styles.aiProsConsLabel}>{t('restaurantDetail.pros')}</Text>
                  {aiSummaryQuery.data.summary.pros.map((pro, index) => (
                    <Text key={index} style={styles.aiProsConsItem}>
                      • {pro}
                    </Text>
                  ))}
                </View>
              ) : null}
              {aiSummaryQuery.data.summary.cons.length > 0 ? (
                <View style={styles.aiProsConsBlock}>
                  <Text style={styles.aiProsConsLabel}>{t('restaurantDetail.cons')}</Text>
                  {aiSummaryQuery.data.summary.cons.map((con, index) => (
                    <Text key={index} style={styles.aiProsConsItem}>
                      • {con}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyInlineText}>{t('restaurantDetail.noAiSummary')}</Text>
          )}
        </View>

        {/* --- Action buttons --- */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[
              styles.actionButton,
              isFavorited ? styles.actionButtonFavorited : styles.actionButtonOutlineOrange,
            ]}
            onPress={handleFavoritePress}
            accessibilityRole="button"
            accessibilityLabel={isFavorited ? t('restaurantDetail.unfavorite') : t('restaurantDetail.favorite')}
            accessibilityState={{ selected: isFavorited }}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorited ? colors.onPrimary : colors.favorite}
            />
            <Text style={isFavorited ? styles.actionButtonText : styles.actionButtonTextOutlineOrange}>
              {isFavorited ? t('restaurantDetail.favorited') : t('restaurantDetail.favoriteAction')}
            </Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleDirections} accessibilityRole="button">
            <Ionicons name="navigate-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.actionButtonText}>{t('restaurantDetail.directions')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionButtonOutline]}
            onPress={handleReport}
            accessibilityRole="button"
          >
            <Ionicons name="flag-outline" size={18} color={colors.error} />
            <Text style={styles.actionButtonTextOutline}>{t('restaurantDetail.report')}</Text>
          </Pressable>
        </View>

        {!isAuthenticated ? (
          <Text style={styles.authHint}>{t('restaurantDetail.authHint')}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
    },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontFamily: FONT_FAMILY.meta },
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, fontFamily: FONT_FAMILY.body },
    retryButton: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
    noPhotoPlaceholder: {
      height: CAROUSEL_HEIGHT,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    noPhotoText: { color: colors.textTertiary, fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold },
    carouselDots: {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    // Deliberately theme-invariant — these dots sit on top of the photo
    // carousel itself, not the app's normal reading surface.
    carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
    carouselDotActive: { backgroundColor: '#fff', width: 8, height: 8, borderRadius: 4 },
    body: { padding: 16 },
    name: { fontSize: 22, fontFamily: FONT_FAMILY.heading, color: colors.textPrimary, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    categoryText: { fontSize: 14, color: colors.textSecondary, fontFamily: FONT_FAMILY.bodySemiBold },
    separatorDot: { fontSize: 13, color: colors.textTertiary },
    priceText: { fontSize: 14, color: colors.textPrimary, fontFamily: FONT_FAMILY.bodySemiBold },
    ratingText: { fontSize: 14, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    ratingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    // Card-ized per the mockup's card-heavy detail layout — every info block
    // (rating, address, hours, facilities, menu, AI summary) is its own
    // white rounded surface instead of a plain divider-separated section.
    section: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, marginBottom: 8 },
    rowStart: { flexDirection: 'row', alignItems: 'flex-start' },
    rowIcon: { marginRight: 8, marginTop: 1 },
    addressText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20, fontFamily: FONT_FAMILY.body },
    phoneText: { fontSize: 14, color: colors.link, fontFamily: FONT_FAMILY.bodySemiBold },
    mapContainer: { height: 140, borderRadius: 14, overflow: 'hidden', marginTop: 10 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    badgeOpen: { backgroundColor: colors.successBg },
    badgeClosed: { backgroundColor: colors.errorBg },
    badgeText: { fontSize: 12, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    hourDay: { fontSize: 13, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    hourTime: { fontSize: 13, color: colors.textPrimary, fontFamily: FONT_FAMILY.bodySemiBold },
    facilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    facilityItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
    facilityLabel: { fontSize: 13, color: colors.textPrimary, fontFamily: FONT_FAMILY.body },
    emptyInlineText: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', fontFamily: FONT_FAMILY.meta },
    aiLabelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      backgroundColor: colors.primarySurface,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginBottom: 8,
    },
    aiLabelBadgeText: { fontSize: 11, fontFamily: FONT_FAMILY.bodyBold, color: colors.primary },
    aiSummaryText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, fontFamily: FONT_FAMILY.body },
    aiProsConsBlock: { marginTop: 10 },
    aiProsConsLabel: { fontSize: 12, fontFamily: FONT_FAMILY.bodyBold, color: colors.textSecondary, marginBottom: 4 },
    aiProsConsItem: { fontSize: 13, color: colors.textPrimary, marginBottom: 2, fontFamily: FONT_FAMILY.body },
    menuRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    menuItemName: { fontSize: 14, color: colors.textPrimary, flex: 1, marginRight: 8, fontFamily: FONT_FAMILY.body },
    menuItemPrice: { fontSize: 14, color: colors.primary, fontFamily: FONT_FAMILY.bodyBold },
    linkText: { fontSize: 14, color: colors.link, fontFamily: FONT_FAMILY.bodyBold, marginTop: 8 },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 12,
    },
    actionButtonOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
    // Favoriting gets its own rose accent (`colors.favorite`), distinct from
    // the generic ink-black `primary` used for Directions — matches the
    // mockup's dedicated heart-icon color.
    actionButtonFavorited: { backgroundColor: colors.favorite },
    actionButtonOutlineOrange: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.favorite },
    actionButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 14 },
    actionButtonTextOutline: { color: colors.error, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 13 },
    actionButtonTextOutlineOrange: { color: colors.favorite, fontFamily: FONT_FAMILY.buttonSemiBold, fontSize: 14 },
    authHint: { marginTop: 14, fontSize: 12, color: colors.textTertiary, textAlign: 'center', fontFamily: FONT_FAMILY.meta },
  });
