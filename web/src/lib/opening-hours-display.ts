// Display-only helpers for OpeningHourDto — shared by restaurant/[slug]'s
// two independent hours renderers (the info-tab card and the sidebar card)
// so the 24h/two-range formatting logic lives in exactly one place.
import type { OpeningHourDto } from '@foodmap/shared-types';

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Same-day portion, or (if overnight) "open from `open` until midnight or past it". */
function isWithinRange(open: string, close: string, nowMinutes: number): boolean {
  const openM = timeToMinutes(open);
  const closeM = timeToMinutes(close);
  if (closeM > openM) return nowMinutes >= openM && nowMinutes < closeM;
  if (closeM < openM) return nowMinutes >= openM || nowMinutes < closeM;
  return false;
}

/**
 * Hours text for a day, as separate lines — e.g. `["08:00 - 22:00"]`, or
 * with a split-shift second range, `["11:00 - 14:00", "17:00 - 22:00"]`.
 * Callers render one line per array entry (stacked) instead of joining with
 * a comma, since a single long inline string doesn't fit the fixed-width
 * time column next to the day label, especially on mobile.
 */
export function getDayHoursLines(hour: OpeningHourDto, closedLabel: string, open24hLabel: string): string[] {
  if (hour.isClosed) return [closedLabel];
  if (hour.isOpen24h) return [open24hLabel];
  const lines = [`${hour.openTime} - ${hour.closeTime}`];
  if (hour.openTime2 && hour.closeTime2) {
    lines.push(`${hour.openTime2} - ${hour.closeTime2}`);
  }
  return lines;
}

/**
 * The closeTime of whichever range is active right now, given today's row
 * — needed because with two ranges (e.g. lunch + dinner), "open until X"
 * must reflect the CURRENTLY active one, not always the first range's
 * close time (that was a real bug: during dinner service it would have
 * shown lunch's closing time). Returns null when not currently in either
 * range (caller should already have `isOpenNow` false in that case) or when
 * the day is 24h (no "until" — see the isOpen24h branch in the caller).
 */
export function getActiveRangeCloseTime(hour: OpeningHourDto | undefined, now: Date): string | null {
  if (!hour || hour.isClosed || hour.isOpen24h) return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (hour.openTime && hour.closeTime && isWithinRange(hour.openTime, hour.closeTime, nowMinutes)) {
    return hour.closeTime;
  }
  if (hour.openTime2 && hour.closeTime2 && isWithinRange(hour.openTime2, hour.closeTime2, nowMinutes)) {
    return hour.closeTime2;
  }
  return null;
}
