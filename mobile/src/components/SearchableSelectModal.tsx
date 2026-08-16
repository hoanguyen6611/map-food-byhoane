import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';

export interface SearchableSelectOption {
  code: string;
  label: string;
}

interface SearchableSelectModalProps {
  visible: boolean;
  title: string;
  options: SearchableSelectOption[];
  selectedCode?: string | null;
  onSelect: (option: SearchableSelectOption) => void;
  onClose: () => void;
  emptyMessage?: string;
}

// Strips diacritics so a guest typing "Ha Noi" (no accents, common on
// mobile keyboards) still matches "Hà Nội" — plain .includes() alone would
// only match exact-accented substrings.
function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/**
 * Generic full-screen searchable list picker — this codebase has no
 * bottom-sheet/combobox library and no existing component that scales past
 * a handful of options (the `Alert.alert`-based pickers in MapScreen only
 * work for ~5 items). Built for Province (34 options) and Ward (up to
 * ~200+ per province) selection, but generic enough to reuse elsewhere.
 * In-memory filtering on every keystroke — fine for lists this size, no
 * debounce needed (that pattern elsewhere is for server-hit search).
 */
export function SearchableSelectModal({
  visible,
  title,
  options,
  selectedCode,
  onSelect,
  onClose,
  emptyMessage = 'Không tìm thấy kết quả phù hợp.',
}: SearchableSelectModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query.trim());
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeForSearch(option.label).includes(normalizedQuery));
  }, [options, query]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
          renderItem={({ item }) => {
            const isSelected = item.code === selectedCode;
            return (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
              >
                <Text style={[styles.rowText, isSelected ? styles.rowTextSelected : null]}>{item.label}</Text>
                {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    closeButton: { padding: 4 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowText: { fontSize: 14, color: colors.textPrimary },
    rowTextSelected: { color: colors.primary, fontWeight: '700' },
    emptyText: { textAlign: 'center', color: colors.textTertiary, fontSize: 13, marginTop: 32 },
  });
