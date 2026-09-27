import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import viMessages from './messages/vi.json';
import enMessages from './messages/en.json';

// Static imports (not a dynamic `import(`./messages/${locale}.json`)`) —
// that pattern compiles to a webpack "context module" whose HMR invalidation
// is unreliable in dev: a message-only edit (no .ts/.tsx touched) sometimes
// doesn't get picked up until the dev server restarts (real incident: a
// newly-added key 404'd with MISSING_MESSAGE despite being correctly on
// disk). A plain static import per locale is fully analyzable by webpack, so
// editing either JSON file hot-reloads exactly like any other module.
const MESSAGES_BY_LOCALE = { vi: viMessages, en: enMessages } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: MESSAGES_BY_LOCALE[locale],
  };
});
