import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useAddRestaurantDraftStore } from '../../store/addRestaurantDraftStore';
import { DEFAULT_REGION_DELTA, HCMC_CENTER } from '../../lib/geo';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'SelectLocation'>;

/**
 * Screen (Select Location) per build-prompts/07 — fixed center pin (the
 * classic "drag the map, pin stays centered" pattern, simpler than a
 * draggable Marker), a "use my GPS" button, and — since no geocoding
 * provider credentials exist in this sandbox — an always-visible manual
 * address fallback rather than a real reverse-geocode display. Returns its
 * result via useAddRestaurantDraftStore (not a nav param) so
 * MainStackParamList doesn't need a `selectedLocation` field just for this
 * one cross-screen handoff.
 *
 * FUTURE: swap in a real reverse-geocoding provider (e.g. Goong Maps API
 * for VN coverage) once credentials exist — see
 * docs/build-prompts/07-contribution-media-moderation-ai.md's Select
 * Location spec.
 */
export function SelectLocationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { location: deviceLocation } = useDeviceLocation();
  const setSelectedLocation = useAddRestaurantDraftStore((s) => s.setSelectedLocation);

  const [center, setCenter] = useState(deviceLocation ?? HCMC_CENTER);

  function handleRegionChangeComplete(region: Region) {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
  }

  function handleUseGps() {
    if (deviceLocation) {
      setCenter(deviceLocation);
    }
  }

  function handleConfirm() {
    setSelectedLocation({ lat: center.latitude, lng: center.longitude });
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...(deviceLocation ?? HCMC_CENTER), ...DEFAULT_REGION_DELTA }}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={deviceLocation !== null}
      />

      <View style={styles.pinContainer} pointerEvents="none">
        <Ionicons name="location" size={40} color={colors.primary} />
      </View>

      {deviceLocation ? (
        <Pressable style={styles.gpsButton} onPress={handleUseGps} accessibilityRole="button" accessibilityLabel={t('selectLocation.gpsButtonAccessibilityLabel')}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={styles.gpsButtonText}>{t('selectLocation.gpsButtonText')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.bottomSheet}>
        <Text style={styles.coordText}>
          {center.latitude.toFixed(6)}, {center.longitude.toFixed(6)}
        </Text>
        <Text style={styles.hint}>{t('selectLocation.hint')}</Text>
        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>{t('selectLocation.confirmButton')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const PIN_SIZE = 40;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    pinContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -PIN_SIZE / 2,
      marginTop: -PIN_SIZE,
    },
    gpsButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    gpsButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    coordText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    hint: { fontSize: 12, color: colors.textTertiary, marginTop: 4, marginBottom: 14 },
    confirmButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    confirmButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
