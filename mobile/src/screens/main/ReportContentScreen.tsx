import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportReason } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useReportContent } from '../../hooks/useReportContent';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'ReportContent'>;

const REASONS: { code: ReportReason; label: string }[] = [
  { code: 'spam', label: 'Spam hoặc quảng cáo' },
  { code: 'inappropriate', label: 'Nội dung không phù hợp' },
  { code: 'incorrect_info', label: 'Thông tin sai lệch' },
  { code: 'duplicate', label: 'Trùng lặp' },
  { code: 'closed_down', label: 'Quán đã đóng cửa' },
  { code: 'other', label: 'Lý do khác' },
];

const DESCRIPTION_MAX_LENGTH = 500;

/** Screen 27 (Report Content) per build-prompts/07 — reason list + optional description. */
export function ReportContentScreen({ route, navigation }: Props) {
  const { targetType, targetId } = route.params;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const reportContent = useReportContent();

  function handleSubmit() {
    if (!reason) return;
    setFormError(null);
    reportContent.mutate(
      { targetType, targetId, reason, description: description.trim() ? description.trim() : undefined },
      {
        onSuccess: () => {
          Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn đã báo cáo — chúng tôi sẽ xem xét sớm.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setFormError('Bạn đã báo cáo nội dung này rồi.');
            return;
          }
          setFormError('Không thể gửi báo cáo. Vui lòng thử lại.');
        },
      },
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Lý do báo cáo *</Text>
      {REASONS.map((item) => (
        <Pressable
          key={item.code}
          style={styles.reasonRow}
          onPress={() => setReason(item.code)}
          accessibilityRole="radio"
          accessibilityState={{ checked: reason === item.code }}
        >
          <Ionicons
            name={reason === item.code ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={reason === item.code ? colors.primary : colors.textTertiary}
          />
          <Text style={styles.reasonLabel}>{item.label}</Text>
        </Pressable>
      ))}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Mô tả thêm (tùy chọn)</Text>
      <TextInput
        style={styles.textarea}
        multiline
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="Cho chúng tôi biết thêm chi tiết..."
        placeholderTextColor={colors.textTertiary}
        value={description}
        onChangeText={setDescription}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Pressable
        style={[styles.submitButton, !reason || reportContent.isPending ? styles.submitButtonDisabled : null]}
        onPress={handleSubmit}
        disabled={!reason || reportContent.isPending}
      >
        <Text style={styles.submitButtonText}>{reportContent.isPending ? 'Đang gửi...' : 'Gửi báo cáo'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    sectionTitleSpaced: { marginTop: 20, marginBottom: 8 },
    reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    reasonLabel: { fontSize: 14, color: colors.textPrimary },
    textarea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    formError: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center' },
    submitButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
