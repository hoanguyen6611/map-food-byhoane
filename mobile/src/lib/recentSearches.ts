import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Client-cached recent search queries for the Search screen (screen 9's
 * "danh sách tìm kiếm gần đây"). Uses AsyncStorage rather than
 * `expo-secure-store` deliberately: this is plain non-sensitive text with
 * more frequent reads/writes than the auth tokens SecureStore is reserved
 * for (see src/lib/secureStorage.ts's doc comment).
 *
 * There is no read API for `SearchHistory` yet (backend persists it
 * write-only for future V2 personalization per the module brief) — this is
 * a purely local, device-side cache of what the user typed.
 */
const STORAGE_KEY = 'search.recentQueries';
const MAX_ENTRIES = 5;

/** Most-recent-first, de-duplicated case-insensitively. */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    // Corrupt/unavailable storage shouldn't crash the Search screen — just
    // behave as if there's no history yet.
    return [];
  }
}

/** Records a query, moving it to the front if already present (case-insensitive), capped at 5. */
export async function addRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;

  try {
    const existing = await getRecentSearches();
    const deduped = existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...deduped].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only — losing a recent-search entry isn't worth surfacing an error.
  }
}
