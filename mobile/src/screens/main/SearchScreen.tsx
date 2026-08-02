import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { addRecentSearch, getRecentSearches } from '../../lib/recentSearches';

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
export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    navigation.navigate('SearchResult', { query: trimmed });
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
          placeholder="Tìm quán ăn, món ăn, khu vực..."
          placeholderTextColor="#999"
          returnKeyType="search"
          onSubmitEditing={() => submitQuery(query)}
        />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.cancelText}>Huỷ</Text>
        </Pressable>
      </View>

      {showLengthHint ? <Text style={styles.hint}>Nhập ít nhất {MIN_QUERY_LENGTH} ký tự để tìm kiếm</Text> : null}

      {showSuggestions ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {recentSearches.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tìm kiếm gần đây</Text>
              {recentSearches.map((item) => (
                <Pressable key={item} style={styles.suggestionRow} onPress={() => submitQuery(item)}>
                  <Text style={styles.suggestionIcon}>🕓</Text>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tìm kiếm phổ biến</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#222',
  },
  cancelText: { fontSize: 15, color: '#e4572e', fontWeight: '600' },
  hint: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: '#a94442' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8, textTransform: 'uppercase' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  suggestionIcon: { fontSize: 15 },
  suggestionText: { fontSize: 15, color: '#333' },
});
