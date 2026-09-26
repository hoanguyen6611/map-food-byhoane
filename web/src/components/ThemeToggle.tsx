'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { SunIcon, MoonIcon } from './icons';

/**
 * Light/dark toggle. `resolvedTheme` depends on the visitor's OS preference
 * or a previously stored choice, neither of which the server render knows —
 * per next-themes' own documented pattern, this renders an invisible
 * placeholder of the same size until mounted client-side, rather than
 * guessing an icon that might flip a moment later.
 */
export function ThemeToggle() {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="theme-toggle-btn" style={{ visibility: 'hidden' }} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      aria-label={isDark ? t('themeToggleToLight') : t('themeToggleToDark')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}
