import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only "Đã đi" (been there) tag for the Saved screen's Muốn thử/Đã đi
 * split ("Ngon v3" reskin). `Favorite` has no such field in the schema — a
 * user marking a saved restaurant as visited is purely a device-side note,
 * same rationale/pattern as `recentSearches.ts`'s AsyncStorage cache. Keyed
 * by restaurantId; presence in the set means "visited".
 */
const STORAGE_KEY = 'saved.visitedRestaurantIds';

async function readSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((entry): entry is string => typeof entry === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

async function writeSet(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Best-effort only, same rationale as recentSearches.ts.
  }
}

export async function getVisitedRestaurantIds(): Promise<Set<string>> {
  return readSet();
}

export async function setVisited(restaurantId: string, visited: boolean): Promise<void> {
  const ids = await readSet();
  if (visited) {
    ids.add(restaurantId);
  } else {
    ids.delete(restaurantId);
  }
  await writeSet(ids);
}
