import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportReason } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useReportContent } from '../../hooks/useReportContent';
import { ApiError } from '../../api/client';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'ReportContent'>;

const REASON_LABEL_KEYS: { code: ReportReason; labelKey: string }[] = [
  { code: 'spam', labelKey: 'reportContent.reasonSpam' },
  { code: 'inappropriate', labelKey: 'reportContent.reasonInappropriate' },
  { code: 'incorrect_info', labelKey: 'reportContent.reasonIncorrectInfo' },
  { code: 'duplicate', labelKey: 'reportContent.reasonDuplicate' },
  { code: 'closed_down', labelKey: 'reportContent.reasonClosedDown' },
  { code: 'other', labelKey: 'reportContent.reasonOther' },
];

const DESCRIPTION_MAX_LENGTH = 500;

/** Screen 27 (Report Content) per build-prompts/07 — reason list + optional description. */
export function ReportContentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
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
          Alert.alert(t('reportContent.successTitle'), t('reportContent.successBody'), [
            { text: t('common.ok'), onPress: () => navigation.goBack() },
          ]);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setFormError(t('reportContent.alreadyReported'));
            return;
          }
          setFormError(t('reportContent.submitError'));
        },
      },
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('reportContent.reasonLabel')}</Text>
      {REASON_LABEL_KEYS.map((item) => (
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
          <Text style={styles.reasonLabel}>{t(item.labelKey)}</Text>
        </Pressable>
      ))}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('reportContent.descriptionLabel')}</Text>
      <TextInput
        style={styles.textarea}
        multiline
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder={t('reportContent.descriptionPlaceholder')}
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
        <Text style={styles.submitButtonText}>{reportContent.isPending ? t('addRestaurant.submitting') : t('reportContent.submitButton')}</Text>
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
      borderRadius: 12,
      padding: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    formError: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center' },
    submitButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
