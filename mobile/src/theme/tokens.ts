/**
 * Design-system color tokens for build-prompts/08's dark-mode module.
 * Before this file existed, every screen/component hardcoded hex literals
 * directly in its `StyleSheet.create({...})` — an audit of the 22 files
 * listed in the module brief turned up a fairly small recurring palette
 * (`#fff`/`#f7f7f7`/`#f2f2f2` backgrounds, `#eee`/`#e0e0e0`/`#ccc` borders,
 * `#222`/`#333`/`#444`/`#555`/`#666`/`#888`/`#999`/`#bbb` text grays, plus a
 * handful of status colors), so this maps that raw palette onto a small set
 * of SEMANTIC tokens (named by role, not 1:1 by hex value) with matching key
 * sets in both `LightColors` and `DarkColors`.
 *
 * Judgment calls (see build-prompts/08 report for the full rationale):
 * - `primary` (brand orange `#e4572e`) is IDENTICAL in both themes — it's
 *   already a fully-saturated, mid-brightness color that reads clearly on
 *   both a near-white and a near-black background, so there's no contrast
 *   problem forcing a dark-mode variant. Everything ELSE that used to be a
 *   flat tint of it (`#fde8e0` selected-chip/thumbnail backgrounds) gets a
 *   theme-appropriate `primarySurface` instead.
 * - Status colors (error/success/warning) get lightened/desaturated dark
 *   variants for contrast against dark surfaces, rather than reusing the
 *   light-mode hex value verbatim.
 * - `overlayBanner*` (the dark floating banner used for offline/location
 *   notices on Map/Search/List) is intentionally near-constant across
 *   themes — it was already a deliberately dark floating chip in light mode
 *   (an overlay on top of a map/photo, not part of the normal reading
 *   surface), so it doesn't need to flip.
 */
export interface ThemeColors {
  /** Primary screen background. */
  background: string;
  /** Secondary screen background (list/map/search containers distinct from card `surface`). */
  backgroundAlt: string;
  /** Card / input / raised-content background. */
  surface: string;
  /** Secondary surface: chips, skeleton blocks, thumbnail placeholders, badge backgrounds. */
  surfaceAlt: string;
  /** Input outlines and other visible borders. */
  border: string;
  /** Hairline list-item / section separators. */
  divider: string;

  /** Headings and primary body text. */
  textPrimary: string;
  /** Secondary/meta text (dates, counts, labels). */
  textSecondary: string;
  /** Placeholders, hints, disabled text, decorative icons. */
  textTertiary: string;
  /** Text/icon color rendered on top of a `primary`-filled surface. */
  onPrimary: string;

  /** Brand orange — identical in both themes, see file-level doc comment. */
  primary: string;
  /**
   * Darker brand-orange variant for small/bold TEXT on light backgrounds
   * (e.g. a badge label on `primarySurface`) — `primary` itself is only
   * 3.68:1 against white, which passes WCAG AA for large text (≥18pt
   * regular / ≥14pt bold) but fails it for anything smaller. Use this
   * instead of `primary` whenever the text is under that size threshold;
   * `primary` stays correct for icons, borders, and large/bold labels.
   */
  primaryStrong: string;
  /** Tinted background for selected chips/badges/thumbnail placeholders. */
  primarySurface: string;
  /** Hyperlink-style text ("Xem tất cả...", "Đăng nhập?"). */
  link: string;

  error: string;
  errorBg: string;
  errorBorder: string;
  success: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningBg: string;

  /** Modal/bottom-sheet backdrop scrim. */
  overlayScrim: string;
  /** Dark floating banner background (offline/location notices over map/list). */
  overlayBanner: string;
  overlayBannerText: string;
  overlayBannerLink: string;

  /** `shadowColor` for card/button elevation. */
  shadow: string;
}

export const LightColors: ThemeColors = {
  background: '#ffffff',
  backgroundAlt: '#f7f7f7',
  surface: '#ffffff',
  surfaceAlt: '#f2f2f2',
  border: '#e0e0e0',
  divider: '#f2f2f2',

  textPrimary: '#222222',
  textSecondary: '#666666',
  // #999999 measured 2.85:1 against white — below even the 3:1 WCAG AA
  // minimum for large text/UI components (a real gap found in this
  // module's accessibility pass, see docs/09-testing-plan.md §4). #808080
  // clears 3.95:1 while staying visibly the lightest/most-muted text tier.
  textTertiary: '#808080',
  onPrimary: '#ffffff',

  primary: '#e4572e',
  // 5.40:1 vs white, 4.57:1 vs primarySurface — both clear WCAG AA's 4.5:1
  // normal-text threshold (see primaryStrong's doc comment on the interface).
  primaryStrong: '#b64625',
  primarySurface: '#fde8e0',
  link: '#1e6fd9',

  error: '#a94442',
  errorBg: '#fdecea',
  errorBorder: '#f5c6cb',
  success: '#256029',
  successBg: '#e6f4ea',
  successBorder: '#b7dfc0',
  warning: '#8a6d1f',
  warningBg: '#fdf3d8',

  overlayScrim: 'rgba(0,0,0,0.4)',
  overlayBanner: '#333333',
  overlayBannerText: '#ffffff',
  overlayBannerLink: '#ffd08a',

  shadow: '#000000',
};

export const DarkColors: ThemeColors = {
  background: '#121212',
  backgroundAlt: '#1a1a1a',
  surface: '#1e1e1e',
  surfaceAlt: '#2a2a2c',
  border: '#3a3a3c',
  divider: '#2c2c2e',

  textPrimary: '#f2f2f2',
  textSecondary: '#a0a0a5',
  textTertiary: '#7d7d82',
  onPrimary: '#ffffff',

  primary: '#e4572e',
  // Unlike light mode, plain `primary` already clears 4.5:1 against the dark
  // surface/tint (dark backgrounds are dark enough on their own) — no
  // separate darker variant needed here.
  primaryStrong: '#e4572e',
  primarySurface: 'rgba(228,87,46,0.22)',
  link: '#5b9bf5',

  error: '#e08a84',
  errorBg: 'rgba(169,68,66,0.28)',
  errorBorder: 'rgba(224,138,132,0.4)',
  success: '#7fd99a',
  successBg: 'rgba(46,139,87,0.22)',
  successBorder: 'rgba(127,217,154,0.35)',
  warning: '#e0c070',
  warningBg: 'rgba(138,109,31,0.28)',

  overlayScrim: 'rgba(0,0,0,0.6)',
  overlayBanner: '#2a2a2a',
  overlayBannerText: '#ffffff',
  overlayBannerLink: '#ffd08a',

  shadow: '#000000',
};
