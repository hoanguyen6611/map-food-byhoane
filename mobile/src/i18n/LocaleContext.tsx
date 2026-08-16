import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { type AppLocale } from './index';

export type LocalePreference = 'system' | AppLocale;

interface LocaleContextValue {
  locale: AppLocale;
  /** The user's explicit choice — 'system' means "follow the device language". */
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
}

// Same idiom as src/theme/ThemeContext.tsx's STORAGE_KEY: a plain
// non-sensitive UI preference, AsyncStorage (not expo-secure-store) is fine.
const STORAGE_KEY = 'locale.preference';

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'vi' || value === 'en';
}

function resolveSystemLocale(): AppLocale {
  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  return deviceLanguage === 'en' ? 'en' : 'vi';
}

/**
 * App-wide locale provider, mirroring ThemeProvider's exact shape
 * (src/theme/ThemeContext.tsx): default 'system' (the device language,
 * falling back to Vietnamese for anything unsupported), with an explicit
 * user override persisted to AsyncStorage so it survives app restarts
 * (SettingsScreen's language selector writes it via `setPreference`).
 *
 * No loading gate on the AsyncStorage read — same tradeoff as theme: the app
 * renders in the resolved 'system' language immediately, then silently
 * swaps to a persisted override a moment later if one exists.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && isLocalePreference(raw)) {
          setPreferenceState(raw);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const locale: AppLocale = preference === 'system' ? resolveSystemLocale() : preference;

  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale]);

  function setPreference(next: LocalePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, preference, setPreference }),
    [locale, preference],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}
