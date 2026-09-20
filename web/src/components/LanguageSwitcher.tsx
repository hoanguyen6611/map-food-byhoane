'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { CheckIcon, ChevronDownIcon } from './icons';

// Language name + region are shown as each language's own self-description
// (same convention as YouTube/X's language pickers) — never re-translated
// through the currently active locale, so "Tiếng Việt · Việt Nam" reads the
// same whether the UI itself is currently in Vietnamese or English.
const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', region: 'Việt Nam', flag: '🇻🇳' },
  { code: 'en', name: 'English', region: 'International', flag: '🇬🇧' },
] as const;

/**
 * Vi/En switcher in the site header — switches locale while staying on the
 * exact current page (same pathname + query string), per next-intl's
 * locale-aware router (`router.replace(pathname, { locale })`). Redesigned
 * from a plain two-button toggle into a flag + code trigger that opens a
 * dropdown menu, per the requested design.
 */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectLocale(code: string) {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code });
  }

  return (
    <div className="lang-switcher" ref={rootRef}>
      <button
        type="button"
        className="lang-trigger"
        aria-label={t('languageSwitcherLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-flag" aria-hidden="true">
          {active.flag}
        </span>
        <span className="lang-trigger-code">{active.code.toUpperCase()}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open ? (
        <div className="lang-menu" role="menu">
          <div className="lang-menu-heading">{t('languageMenuHeading')}</div>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="menuitemradio"
              aria-checked={lang.code === locale}
              className="lang-menu-item"
              onClick={() => selectLocale(lang.code)}
            >
              <span className="lang-flag lang-flag-lg" aria-hidden="true">
                {lang.flag}
              </span>
              <span className="lang-menu-text">
                <span className="lang-menu-name">{lang.name}</span>
                <span className="lang-menu-region">{lang.region}</span>
              </span>
              {lang.code === locale ? <CheckIcon size={16} className="lang-menu-check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
