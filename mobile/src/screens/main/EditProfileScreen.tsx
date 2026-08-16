import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { AvatarPicker } from '../../components/media/AvatarPicker';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

// Per docs/06-database-erd.md / UpdateProfileRequest contract: VN phone
// format, `+84` or leading `0` followed by 9-10 digits.
const VN_PHONE_REGEX = /^(\+84|0)\d{9,10}$/;

export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: authApi.me });

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [newAvatarPhotoId, setNewAvatarPhotoId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Pre-fill the form once `GET /me` resolves (task 5 requirement).
  useEffect(() => {
    if (meQuery.data && !isDirty) {
      setDisplayName(meQuery.data.profile.displayName ?? '');
      setBio(meQuery.data.profile.bio ?? '');
      setHomeCity(meQuery.data.profile.homeCity ?? '');
    }
  }, [meQuery.data, isDirty]);

  function markDirty<T>(setter: (value: T) => void) {
    return (value: T) => {
      setIsDirty(true);
      setter(value);
    };
  }

  const displayNameValid = displayName.trim().length >= 2 && displayName.trim().length <= 50;
  const phoneValid = phone.trim().length === 0 || VN_PHONE_REGEX.test(phone.trim());
  const canSave = displayNameValid && phoneValid && !isSaving;

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setPhoneError(null);
    try {
      const updated = await authApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        homeCity: homeCity.trim(),
        ...(phone.trim().length > 0 ? { phone: phone.trim() } : {}),
        // Untouched avatar stays untouched — only send it when the picker
        // actually produced a new, confirmed photo this session.
        ...(newAvatarPhotoId ? { avatarPhotoId: newAvatarPhotoId } : {}),
      });
      queryClient.setQueryData(['me'], updated);
      setUser(updated.user);
      navigation.goBack();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        // Surface the API's validation message inline; it's the source of
        // truth for phone-format errors (client-side check is best-effort).
        setPhoneError(error.message);
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('auth.networkError'));
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (meQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (meQuery.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('editProfile.loadError')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <AvatarPicker
          currentAvatarUrl={meQuery.data?.profile.avatarUrl ?? null}
          displayName={displayName}
          onAvatarPhotoIdChange={(photoId) => {
            setIsDirty(true);
            setNewAvatarPhotoId(photoId);
          }}
        />

        <View style={styles.card}>
          <Text style={styles.label}>{t('editProfile.displayNameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={markDirty(setDisplayName)}
            placeholder={t('editProfile.displayNamePlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />
          {!displayNameValid && displayName.length > 0 ? (
            <Text style={styles.fieldError}>{t('editProfile.displayNameError')}</Text>
          ) : null}

          <Text style={styles.label}>{t('editProfile.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(value) => {
              markDirty(setPhone)(value);
              setPhoneError(null);
            }}
            keyboardType="phone-pad"
            placeholder={t('editProfile.phonePlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />
          {(!phoneValid || phoneError) && (
            <Text style={styles.fieldError}>
              {phoneError ?? t('editProfile.phoneFormatError')}
            </Text>
          )}

          <Text style={styles.label}>{t('editProfile.bioLabel')}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={markDirty(setBio)}
            placeholder={t('editProfile.bioPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
          />

          <Text style={styles.label}>{t('editProfile.homeCityLabel')}</Text>
          <TextInput
            style={styles.input}
            value={homeCity}
            onChangeText={markDirty(setHomeCity)}
            placeholder={t('editProfile.homeCityPlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <Pressable style={[styles.button, !canSave && styles.buttonDisabled]} onPress={handleSave} disabled={!canSave}>
          {isSaving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{t('common.save')}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    container: { flexGrow: 1, padding: 24, backgroundColor: colors.background },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    label: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, marginBottom: 6, color: colors.textPrimary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontFamily: FONT_FAMILY.body,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    fieldError: { color: colors.error, fontSize: 13, marginBottom: 12, fontFamily: FONT_FAMILY.meta },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontFamily: FONT_FAMILY.buttonSemiBold },
    errorBanner: {
      backgroundColor: colors.errorBg,
      borderColor: colors.errorBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { color: colors.error, fontSize: 14, fontFamily: FONT_FAMILY.body },
  });
