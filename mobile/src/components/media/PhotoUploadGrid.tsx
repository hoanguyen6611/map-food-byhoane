import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { MediaOwnerType } from '@foodmap/shared-types';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

interface Props {
  ownerType: MediaOwnerType;
  maxPhotos: number;
  onPhotoIdsChange: (photoIds: string[]) => void;
}

/**
 * Shared upload-media component (build-prompts/07's screen 20 spec: "là
 * component nhúng, không có màn hình riêng biệt") — reused inline by both
 * AddRestaurantScreen's "Ảnh" step and WriteReviewScreen's retrofit. Drives
 * the real signed-upload pipeline via useMediaUpload; client-side
 * size/type pre-checks reject obviously-bad files fast, but the backend's
 * magic-byte/re-encode step (MediaService.confirm) is the real security boundary.
 */
export function PhotoUploadGrid({ ownerType, maxPhotos, onPhotoIdsChange }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { items, addPhoto, removePhoto, photoIds } = useMediaUpload(ownerType, maxPhotos);

  // Notifies the parent only when the confirmed id list actually changes —
  // avoids an infinite update loop from a new array reference every render.
  const lastPhotoIdsRef = useRef<string>('');
  useEffect(() => {
    const key = photoIds.join(',');
    if (key !== lastPhotoIdsRef.current) {
      lastPhotoIdsRef.current = key;
      onPhotoIdsChange(photoIds);
    }
  }, [photoIds, onPhotoIdsChange]);

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh trong Cài đặt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, maxPhotos - items.length),
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const outcome = await addPhoto({ uri: asset.uri, fileSize: asset.fileSize, mimeType: asset.mimeType });
      if (!outcome.ok) {
        Alert.alert('Không thể thêm ảnh', outcome.error);
        break;
      }
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập máy ảnh trong Cài đặt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const outcome = await addPhoto({ uri: asset.uri, fileSize: asset.fileSize, mimeType: asset.mimeType });
    if (!outcome.ok) {
      Alert.alert('Không thể thêm ảnh', outcome.error);
    }
  }

  const canAddMore = items.length < maxPhotos;

  return (
    <View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có ảnh nào được thêm</Text>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <View key={item.localUri} style={styles.tile}>
              <Image source={{ uri: item.localUri }} style={styles.thumbnail} />
              {item.status === 'uploading' || item.status === 'confirming' ? (
                <View style={styles.progressOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  {item.status === 'uploading' ? (
                    <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
                  ) : null}
                </View>
              ) : null}
              {item.status === 'error' ? (
                <View style={[styles.progressOverlay, styles.errorOverlay]}>
                  <Ionicons name="alert-circle" size={20} color="#fff" />
                </View>
              ) : null}
              <Pressable
                style={styles.removeButton}
                onPress={() => removePhoto(item.localUri)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Xóa ảnh"
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {canAddMore ? (
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={takePhoto} accessibilityRole="button" accessibilityLabel="Chụp ảnh">
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Chụp ảnh</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={pickFromLibrary} accessibilityRole="button" accessibilityLabel="Chọn ảnh từ thư viện">
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Chọn từ thư viện</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const TILE_SIZE = 84;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    emptyText: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
    thumbnail: { width: '100%', height: '100%' },
    progressOverlay: {
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    errorOverlay: { backgroundColor: 'rgba(180,30,30,0.55)' },
    progressText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    removeButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    actionButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  });
