'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Props {
  children: ReactNode;
  /** Stagger offset in seconds — pass a list item's index (× a small step) so a grid/row of these animates in one after another instead of all at once. */
  delay?: number;
  /** Starting vertical offset in px (animates from this down to 0). */
  y?: number;
  className?: string;
}

/**
 * Fades + slides an element up as it scrolls into view (GSAP ScrollTrigger)
 * — a thin Client Component wrapper so Server Component pages (every page
 * this is used on) don't have to become client components themselves; the
 * server-rendered `children` just pass through. `once: true` — this is an
 * entrance effect, not a scroll-linked one, so it doesn't replay on scroll
 * back up. Respects `prefers-reduced-motion`: skips the animation entirely
 * and renders children already at their resting state, same as
 * SmoothScrollProvider skipping Lenis for the same setting.
 */
export function Reveal({ children, delay = 0, y = 24, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            once: true,
          },
        },
      );
    });

    return () => ctx.revert();
  }, [delay, y]);

  return (
    // `minWidth: 0` — this wrapper is often the direct child of a CSS Grid
    // (card-grid/cat-grid/area-grid), making IT the actual grid item
    // instead of whatever element `children` renders. A grid item's
    // default `min-width: auto` sizes it to its content's min-content
    // width, which a long restaurant/category name can exceed, overflowing
    // the track (and the page) sideways — happened even after `.place-card`
    // itself got the same fix, because this wrapper sits *outside* it.
    // Harmless everywhere this isn't a flex/grid item (sets no floor,
    // which block layout doesn't need anyway).
    <div ref={ref} className={className} style={{ minWidth: 0 }}>
      {children}
    </div>
  );
}
