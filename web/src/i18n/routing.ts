import { defineRouting } from 'next-intl/routing';

// Vietnamese is the existing/default locale — kept unprefixed ('as-needed')
// so every URL already indexed by search engines (`/`, `/search`,
// `/restaurant/[slug]`, `/district/[slug]`) keeps working exactly as today.
// English gets an explicit `/en/...` prefix.
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // Without this, next-intl's middleware negotiates the visitor's browser
  // `Accept-Language` header on their very first visit and silently
  // redirects an English-preferring browser to `/en` — even though 'vi' is
  // the intended default for everyone. Disabling detection means every
  // unprefixed URL always serves Vietnamese; `/en` still works for anyone
  // who explicitly wants it (the language switcher, a direct `/en` link).
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
