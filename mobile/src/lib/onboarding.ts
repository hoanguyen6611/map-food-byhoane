import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only "has this device seen Onboarding" flag (screen 2's
 * `has_onboarded` requirement) — plain AsyncStorage, same rationale as
 * src/lib/recentSearches.ts (non-sensitive, no need for expo-secure-store).
 */
const STORAGE_KEY = 'onboarding.hasOnboarded';

export async function getHasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    // Corrupt/unavailable storage: fail open by treating as "not onboarded"
    // rather than crashing the boot sequence — worst case, the user sees
    // Onboarding again, which is harmless.
    return false;
  }
}

export async function setHasOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Best-effort — if this fails, Onboarding just shows again next launch.
  }
}
