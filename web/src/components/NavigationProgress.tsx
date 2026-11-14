'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Slim top progress bar + instant feedback for App Router navigations,
 * which have no built-in "navigation started" event. Starts on:
 *  - a click on any same-origin <a> leading to a different URL,
 *  - a GET <form> submit (search filters),
 *  - `window.dispatchEvent(new Event('fm:navstart'))` for router.push callers.
 * Finishes when pathname/search params change (or after a safety timeout).
 *
 * While pending it also sets, outside React's control (plain DOM attributes
 * React never manages, so nothing to reconcile):
 *  - `data-nav-target` on the clicked link → CSS shows that tab as active
 *    immediately (bottom tab bar, Thông tin/Đánh giá, notification filters);
 *  - `html[data-nav-pending="same"|"page"]` → "same" (only the query changed,
 *    i.e. a tab/filter on the current page, where loading.tsx doesn't show)
 *    softly dims the content instead of leaving it frozen.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const state = useRef({ active: false, value: 0, trickle: 0, safety: 0, hide: 0, target: null as Element | null });
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const s = state.current;
    const bar = barRef.current;
    if (!bar) return;

    const render = () => {
      bar.style.transform = `scaleX(${s.value})`;
    };

    const cleanupMarks = () => {
      s.target?.removeAttribute('data-nav-target');
      s.target = null;
      delete document.documentElement.dataset.navPending;
    };

    const start = (kind: 'same' | 'page', target: Element | null) => {
      window.clearTimeout(s.hide);
      window.clearInterval(s.trickle);
      window.clearTimeout(s.safety);
      cleanupMarks();
      s.active = true;
      s.value = 0.08;
      bar.style.transition = 'none';
      bar.style.opacity = '1';
      render();
      // Force the reset to paint before animating again.
      void bar.offsetWidth;
      bar.style.transition = 'transform 0.25s ease, opacity 0.3s ease';
      s.value = 0.25;
      render();
      // Ease toward ~90% — never "finishes" on its own.
      s.trickle = window.setInterval(() => {
        s.value += (0.9 - s.value) * 0.12;
        render();
      }, 250);
      s.safety = window.setTimeout(() => finish(), 10000);
      document.documentElement.dataset.navPending = kind;
      if (target) {
        target.setAttribute('data-nav-target', '');
        s.target = target;
      }
    };

    const finish = () => {
      if (!s.active) return;
      s.active = false;
      window.clearInterval(s.trickle);
      window.clearTimeout(s.safety);
      cleanupMarks();
      s.value = 1;
      render();
      s.hide = window.setTimeout(() => {
        bar.style.opacity = '0';
        s.hide = window.setTimeout(() => {
          bar.style.transition = 'none';
          s.value = 0;
          render();
        }, 300);
      }, 200);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      // Same page + only a #hash change, or exactly the current URL: nothing loads.
      if (url.pathname === location.pathname && url.search === location.search) return;
      // Plain route handlers that redirect (e.g. /notifications/open/:id) still end in a navigation — fine.
      start(url.pathname === location.pathname ? 'same' : 'page', a);
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || e.defaultPrevented || (form.method || 'get').toLowerCase() !== 'get') return;
      let url: URL;
      try {
        url = new URL(form.action || location.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      start(url.pathname === location.pathname ? 'same' : 'page', null);
    };

    const onManualStart = () => start('page', null);

    // Capture phase: runs before next/link's own handler calls preventDefault.
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('fm:navstart', onManualStart);
    finishRef.current = finish;
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('fm:navstart', onManualStart);
      window.clearInterval(s.trickle);
      window.clearTimeout(s.safety);
      window.clearTimeout(s.hide);
    };
  }, []);

  // The new route (or query) has rendered → complete the bar.
  useEffect(() => {
    finishRef.current();
  }, [pathname, searchParams]);

  return <div ref={barRef} className="nav-progress" aria-hidden="true" />;
}
