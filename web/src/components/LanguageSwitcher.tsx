'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Vi/En toggle in the site header — switches locale while staying on the
 * exact current page (same pathname + query string), per next-intl's
 * locale-aware router (`router.replace(pathname, { locale })`).
 */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');

  return (
    <div className="lang-switcher" role="group" aria-label={t('languageSwitcherLabel')}>
      <button
        type="button"
        className={locale === 'vi' ? 'lang-active' : undefined}
        aria-pressed={locale === 'vi'}
        onClick={() => router.replace(pathname, { locale: 'vi' })}
      >
        Tiếng Việt
      </button>
      <button
        type="button"
        className={locale === 'en' ? 'lang-active' : undefined}
        aria-pressed={locale === 'en'}
        onClick={() => router.replace(pathname, { locale: 'en' })}
      >
        English
      </button>
    </div>
  );
}
