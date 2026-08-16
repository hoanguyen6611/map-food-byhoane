import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi } from './locales/vi';
import { en } from './locales/en';

export type AppLocale = 'vi' | 'en';

// Dev-time guard: catches a translation added to one locale file but
// forgotten in the other before it ships as a silent fallback-to-key bug.
if (__DEV__) {
  const flatten = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? flatten(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  const viKeys = flatten(vi).sort();
  const enKeys = flatten(en).sort();
  if (viKeys.join('|') !== enKeys.join('|')) {
    console.warn('[i18n] vi/en translation key sets differ — see mobile/src/i18n/locales/*.ts');
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: {
    // React already escapes rendered text — no need for i18next to also do it.
    escapeValue: false,
  },
  // RN's Hermes engine has no Intl.PluralRules by default pre-formatting;
  // this app doesn't use i18next's plural suffixes (`_one`/`_other`) so the
  // default v4-style pluralization resolution is never exercised, but this
  // avoids a console warning some Hermes builds emit otherwise.
  compatibilityJSON: 'v4',
});

export default i18n;
