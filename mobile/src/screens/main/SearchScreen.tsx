import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { MainStackParamList } from '../../navigation/types';
import { addRecentSearch, getRecentSearches } from '../../lib/recentSearches';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';

type Props = NativeStackScreenProps<MainStackParamList, 'Search'>;

// Hardcoded popular-query suggestions (screen 9's "gợi ý phổ biến mặc định"),
// shown only once there's no local search history yet.
const POPULAR_QUERIES = ['Cơm tấm', 'Bún chả', 'Cà phê', 'Phở', 'Bánh mì'];

// Screen 9's spec: query must be >= 2 chars to submit an exact-text search.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Screen 9 (Search) per docs/04-screen-list.md: full-focus text input,
 * recent-searches list (task 3's local AsyncStorage cache), and a hardcoded
 * popular-query fallback when there's no history yet. Submitting (Enter, or
 * tapping any suggestion/recent item) records the query and navigates to
 * SearchResultScreen — no live autocomplete network call exists in this
 * module (that's out of scope, see build-prompts/04), so the 300ms debounce
 * only gates the below-input length hint, avoiding a flicker on every
 * keystroke while the user is still typing.
 */
export function SearchScreen({ navigation, route }: Props) {
  const { mode, category } = route.params ?? {};
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  useEffect(() => {
    let cancelled = false;
    getRecentSearches().then((items) => {
      if (!cancelled) setRecentSearches(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  async function submitQuery(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    await addRecentSearch(trimmed);
    setRecentSearches(await getRecentSearches());
    navigation.navigate('SearchResult', { query: trimmed, mode, category });
  }

  const trimmedDebounced = debouncedQuery.trim();
  const showLengthHint = trimmedDebounced.length > 0 && trimmedDebounced.length < MIN_QUERY_LENGTH;
  const showSuggestions = query.trim().length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          autoFocus
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={() => submitQuery(query)}
        />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>

      {showLengthHint ? <Text style={styles.hint}>{t('search.lengthHint', { count: MIN_QUERY_LENGTH })}</Text> : null}

      {showSuggestions ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {recentSearches.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.recent')}</Text>
              {recentSearches.map((item) => (
                <Pressable key={item} style={styles.suggestionRow} onPress={() => submitQuery(item)}>
                  <Text style={styles.suggestionIcon}>🕓</Text>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.popular')}</Text>
              {POPULAR_QUERIES.map((item) => (
                <Pressable key={item} style={styles.suggestionRow} onPress={() => submitQuery(item)}>
                  <Text style={styles.suggestionIcon}>🔥</Text>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 12,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
    },
    cancelText: { fontSize: 15, color: colors.primary, fontFamily: FONT_FAMILY.bodySemiBold },
    hint: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: colors.error },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
    section: { marginTop: 16 },
    sectionTitle: {
      fontSize: 13,
      fontFamily: FONT_FAMILY.bodyBold,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    suggestionIcon: { fontSize: 15 },
    suggestionText: { fontSize: 15, color: colors.textPrimary },
  });
