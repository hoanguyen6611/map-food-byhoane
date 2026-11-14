'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Site-wide smooth scroll (Lenis), driven by GSAP's own ticker instead of
 * its own rAF loop — the standard Lenis+GSAP integration, so
 * ScrollTrigger-based animations (see Reveal.tsx) read the smoothed scroll
 * position instead of racing against it. Skipped entirely under
 * `prefers-reduced-motion`: native scroll then behaves exactly as that
 * OS/browser setting expects, nothing here overrides it.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);

    // GSAP's ticker hands back total elapsed time in SECONDS; Lenis's own
    // `raf` expects a millisecond timestamp (same units as
    // `performance.now()`/rAF) — the `* 1000` is Lenis's own documented
    // GSAP integration snippet, not an arbitrary conversion.
    function update(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
