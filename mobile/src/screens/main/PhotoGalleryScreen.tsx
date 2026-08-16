import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PhotoDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantDetail } from '../../hooks/useRestaurantDetail';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'PhotoGallery'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const THUMB_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

/**
 * Screen 13 (Photo Gallery) per docs/04-screen-list.md. `PhotoDto` carries no
 * category/source field, so there is no data to back the original spec's
 * "tabbed by source (owner/user-submitted)" idea — this renders a single
 * flat grid instead of fabricating tabs the backend can't support.
 */
export function PhotoGalleryScreen({ route }: Props) {
  const { t } = useTranslation();
  const { restaurantId } = route.params;
  const detailQuery = useRestaurantDetail(restaurantId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (detailQuery.isError) {
    const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{isNotFound ? t('restaurantDetail.notFoundTitle') : t('common.noConnectionTitle')}</Text>
        {!isNotFound ? (
          <Pressable style={styles.retryButton} onPress={() => detailQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const photos: PhotoDto[] = detailQuery.data?.photos ?? [];

  if (photos.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="image-outline" size={40} color={colors.textTertiary} />
        <Text style={styles.emptyText}>{t('photoGallery.emptyText')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setViewerIndex(index)}>
            <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
          </Pressable>
        )}
      />

      <Modal
        visible={viewerIndex !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerContainer}>
          <Pressable style={styles.viewerCloseButton} onPress={() => setViewerIndex(null)} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {viewerIndex !== null ? (
            <FlatList
              data={photos}
              keyExtractor={(photo) => photo.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              renderItem={({ item }) => (
                <View style={styles.viewerPage}>
                  <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
      gap: 10,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: colors.error, textAlign: 'center' },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600' },
    row: { gap: GRID_GAP },
    thumb: { width: THUMB_SIZE, height: THUMB_SIZE, marginBottom: GRID_GAP, backgroundColor: colors.surfaceAlt },
    // The full-screen photo viewer is deliberately always black (standard
    // photo-viewer convention, like Photos apps), independent of app theme.
    viewerContainer: { flex: 1, backgroundColor: '#000' },
    viewerCloseButton: {
      position: 'absolute',
      top: 52,
      right: 16,
      zIndex: 1,
      padding: 8,
    },
    viewerPage: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: SCREEN_WIDTH, height: '100%' },
  });
