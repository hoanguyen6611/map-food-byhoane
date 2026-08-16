import { defineRouting } from 'next-intl/routing';

// Vietnamese is the existing/default locale — kept unprefixed ('as-needed')
// so every URL already indexed by search engines (`/`, `/search`,
// `/restaurant/[slug]`, `/district/[slug]`) keeps working exactly as today.
// English gets an explicit `/en/...` prefix.
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
