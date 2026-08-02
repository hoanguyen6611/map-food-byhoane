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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

// Per docs/06-database-erd.md / UpdateProfileRequest contract: VN phone
// format, `+84` or leading `0` followed by 9-10 digits.
const VN_PHONE_REGEX = /^(\+84|0)\d{9,10}$/;

export function EditProfileScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: authApi.me });

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Pre-fill the form once `GET /me` resolves (task 5 requirement); avatar
  // is intentionally left untouched — no media upload pipeline until Module 7.
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
        setErrorMessage('Lỗi mạng, vui lòng thử lại.');
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
        <Text style={styles.errorText}>Không thể tải hồ sơ. Vui lòng thử lại.</Text>
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

        <Text style={styles.label}>Tên hiển thị</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={markDirty(setDisplayName)}
          placeholder="Tên hiển thị"
        />
        {!displayNameValid && displayName.length > 0 ? (
          <Text style={styles.fieldError}>Tên phải từ 2-50 ký tự.</Text>
        ) : null}

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(value) => {
            markDirty(setPhone)(value);
            setPhoneError(null);
          }}
          keyboardType="phone-pad"
          placeholder="0912345678"
        />
        {(!phoneValid || phoneError) && (
          <Text style={styles.fieldError}>
            {phoneError ?? 'Số điện thoại không đúng định dạng Việt Nam.'}
          </Text>
        )}

        <Text style={styles.label}>Giới thiệu ngắn</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={markDirty(setBio)}
          placeholder="Vài dòng về bạn"
          multiline
        />

        <Text style={styles.label}>Thành phố</Text>
        <TextInput
          style={styles.input}
          value={homeCity}
          onChangeText={markDirty(setHomeCity)}
          placeholder="TP. Hồ Chí Minh"
        />

        <Pressable style={[styles.button, !canSave && styles.buttonDisabled]} onPress={handleSave} disabled={!canSave}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Lưu</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  fieldError: { color: '#a94442', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: '#e4572e',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBanner: {
    backgroundColor: '#fdecea',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#a94442', fontSize: 14 },
});
