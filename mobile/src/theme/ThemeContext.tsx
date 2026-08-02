import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, type ThemeColors } from './tokens';

// Re-exported so screens/components only need one import path
// (`../theme/ThemeContext`) for both the `useTheme()` hook and the
// `ThemeColors` type their `createStyles(colors: ThemeColors)` signature needs.
export type { ThemeColors };

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  /** The user's explicit choice — 'system' means "follow the OS setting". */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

// AsyncStorage (not expo-secure-store) per src/lib/recentSearches.ts's idiom:
// this is a plain non-sensitive UI preference, not a credential.
const STORAGE_KEY = 'theme.preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * App-wide theme provider (build-prompts/08). Default is 'system' — the OS
 * `useColorScheme()` value — with an explicit user override ('light'/'dark')
 * persisted to AsyncStorage so it survives app restarts (SettingsScreen's
 * 3-way selector writes it via `setPreference`).
 *
 * No loading gate on the AsyncStorage read: `preference` starts as 'system'
 * (which renders correctly immediately, using the OS scheme) and silently
 * swaps to the persisted override a moment later if one exists — a brief
 * flash of the system theme on cold start (only when the user previously
 * overrode it away from 'system') was judged an acceptable tradeoff against
 * adding a boot-time loading screen just for this.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && isThemePreference(raw)) {
          setPreferenceState(raw);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }

  const scheme: ColorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? DarkColors : LightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
