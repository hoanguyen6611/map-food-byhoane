import { ScrollView, StyleSheet, Text } from 'react-native';
import { useState } from 'react';
import { PhotoUploadGrid } from '../../components/media/PhotoUploadGrid';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

const MAX_PHOTOS = 10;

/**
 * Screen 20 (Upload Media) per docs/04-screen-list.md: "là component nhúng,
 * không có màn hình riêng biệt" — the real reusable unit is
 * `PhotoUploadGrid`, embedded inline by AddRestaurantScreen's "Ảnh" step and
 * WriteReviewScreen's retrofit. This nav entry stays reserved (already
 * wired in MainStackParamList) as a standalone full-screen gallery-manager
 * fallback, but normal flows never navigate here directly.
 */
export function UploadMediaScreen() {
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        {photoIds.length > 0 ? `Đã thêm ${photoIds.length} ảnh.` : 'Thêm ảnh cho quán ăn hoặc đánh giá của bạn.'}
      </Text>
      <PhotoUploadGrid ownerType="restaurant" maxPhotos={MAX_PHOTOS} onPhotoIdsChange={setPhotoIds} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16 },
    hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  });
