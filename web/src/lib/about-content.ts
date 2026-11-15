import { createTranslator } from 'next-intl';
import type { SiteSettingsDto } from '@foodmap/shared-types';
import { getSiteSettings } from './api';

/**
 * `t()` over the About page copy — the admin-edited version from site
 * settings (defaults in packages/shared-types/src/site-settings.ts), not the
 * static i18n files, so edits in admin-web show up without a deploy.
 */
export async function getAboutTranslator(locale: string, settings?: SiteSettingsDto) {
  const s = settings ?? (await getSiteSettings());
  const messages = locale === 'en' ? s.about.en : s.about.vi;
  return createTranslator({ locale, messages: { about: messages }, namespace: 'about' });
}
