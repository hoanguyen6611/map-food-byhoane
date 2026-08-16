import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';

interface Props {
  currentAvatarUrl: string | null;
  displayName: string;
  onAvatarPhotoIdChange: (photoId: string) => void;
}

const AVATAR_SIZE = 96;

/**
 * Single-photo avatar picker for EditProfileScreen — reuses `useMediaUpload`
 * (the same signed-upload pipeline `PhotoUploadGrid` drives for
 * restaurant/review photos) with `maxPhotos=1` and `ownerType: 'user_profile'`,
 * just rendered as a circular preview instead of a grid tile.
 */
export function AvatarPicker({ currentAvatarUrl, displayName, onAvatarPhotoIdChange }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { items, addPhoto } = useMediaUpload('user_profile', 1);
  const picked = items[0];

  // Same "notify parent only on real change" guard as PhotoUploadGrid.
  const lastReportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (picked?.status === 'done' && picked.photoId && picked.photoId !== lastReportedRef.current) {
      lastReportedRef.current = picked.photoId;
      onAvatarPhotoIdChange(picked.photoId);
    }
  }, [picked, onAvatarPhotoIdChange]);

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh trong Cài đặt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const outcome = await addPhoto({ uri: asset.uri, fileSize: asset.fileSize, mimeType: asset.mimeType });
    if (!outcome.ok) Alert.alert('Không thể đổi ảnh đại diện', outcome.error);
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
    if (!outcome.ok) Alert.alert('Không thể đổi ảnh đại diện', outcome.error);
  }

  function handlePress() {
    Alert.alert('Đổi ảnh đại diện', undefined, [
      { text: 'Chụp ảnh', onPress: takePhoto },
      { text: 'Chọn từ thư viện', onPress: pickFromLibrary },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  }

  const previewUri = picked?.localUri ?? currentAvatarUrl;
  const initial = displayName.trim().charAt(0).toUpperCase();
  const isBusy = picked !== undefined && picked.status !== 'done' && picked.status !== 'error';

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.circle}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Đổi ảnh đại diện"
      >
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.image} /> : <Text style={styles.initial}>{initial || '?'}</Text>}
        {isBusy ? (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
        <View style={styles.badge}>
          <Ionicons name="camera" size={14} color={colors.onPrimary} />
        </View>
      </Pressable>
      {picked?.status === 'error' ? <Text style={styles.errorText}>{picked.errorMessage}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { alignItems: 'center', marginBottom: 20 },
    circle: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    initial: { fontSize: 36, fontFamily: FONT_FAMILY.heading, color: colors.primary },
    overlay: {
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    errorText: { color: colors.error, fontSize: 12, marginTop: 6, fontFamily: FONT_FAMILY.meta },
  });
