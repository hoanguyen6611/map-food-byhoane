// Vietnam is UTC+7 year-round (no DST), so "current VN time" can be computed
// with a fixed offset instead of a timezone database lookup — always correct
// for this product's single-country MVP scope (docs/01-prd-mvp.md §2).
const VN_OFFSET_MINUTES = 7 * 60;
const MINUTES_PER_DAY = 24 * 60;

export interface OpeningHourRow {
  dayOfWeek: number; // 0=Sunday..6=Saturday, matches Prisma schema
  openTime: Date | null; // Postgres `time` column decoded by Prisma as a Date on 1970-01-01
  closeTime: Date | null;
  isClosed: boolean;
  // Optional (not required) so existing call sites/tests that predate these
  // two fields keep working unchanged — absent is treated as "no" / "none".
  isOpen24h?: boolean;
  openTime2?: Date | null;
  closeTime2?: Date | null;
}

export interface VnNow {
  dayOfWeek: number;
  minutesSinceMidnight: number;
}

/** Converts a UTC instant into Vietnam wall-clock day-of-week + minutes-since-midnight. */
export function toVnNow(date: Date): VnNow {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  let vnMinutes = utcMinutes + VN_OFFSET_MINUTES;
  let dayOffset = 0;
  if (vnMinutes >= MINUTES_PER_DAY) {
    vnMinutes -= MINUTES_PER_DAY;
    dayOffset = 1;
  }
  const dayOfWeek = (date.getUTCDay() + dayOffset) % 7;
  return { dayOfWeek, minutesSinceMidnight: vnMinutes };
}

function timeToMinutes(time: Date | null | undefined): number | null {
  if (!time) return null;
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

/** Same-day portion of a range, or (if overnight) the "open from `open` until midnight" portion. */
function isWithinRangeToday(open: number, close: number, minutesSinceMidnight: number): boolean {
  if (close > open) {
    return minutesSinceMidnight >= open && minutesSinceMidnight < close;
  }
  if (close < open) {
    // Overnight — the early-morning portion (before `close`) belongs to
    // *yesterday's* row and is handled by isWithinOvernightSpillover below.
    return minutesSinceMidnight >= open;
  }
  // open === close is not a meaningful bound (would mean 0 or 24h) — treat
  // as invalid data rather than guessing. Use isOpen24h for "always open".
  return false;
}

/** Early-morning portion of an overnight range that started the previous day. */
function isWithinOvernightSpillover(open: number, close: number, minutesSinceMidnight: number): boolean {
  return close < open && minutesSinceMidnight < close;
}

// Row's own range plus, when present, its second range — a day can have at
// most two (e.g. 11:00-14:00 lunch + 17:00-22:00 dinner), never an
// arbitrary list. A lone openTime2/closeTime2 without its pair is treated
// as "no second range" (same normalization the write path already applies).
function rangesOf(row: OpeningHourRow): { open: Date | null; close: Date | null }[] {
  const ranges = [{ open: row.openTime, close: row.closeTime }];
  if (row.openTime2 && row.closeTime2) {
    ranges.push({ open: row.openTime2, close: row.closeTime2 });
  }
  return ranges;
}

/**
 * Whether a restaurant is open at `vnNow`, given its weekly `OpeningHour` rows.
 * Handles: `isOpen24h` (short-circuits to open for that entire calendar day,
 * no time comparison needed); up to two time ranges per day (each checked
 * independently — a restaurant closed in the gap between lunch and dinner
 * service is correctly reported closed); and overnight hours (closeTime <
 * openTime, e.g. 18:00 -> 02:00) for either range — a row open past
 * midnight is checked against BOTH its own day (evening portion) and the
 * following day (early-morning portion still belonging to the previous
 * day's business hours) — see docs/06-database-erd.md §3 OpeningHour
 * business rule.
 */
export function isOpenNow(hours: OpeningHourRow[], vnNow: VnNow): boolean {
  const todayRow = hours.find((h) => h.dayOfWeek === vnNow.dayOfWeek);
  if (todayRow && !todayRow.isClosed) {
    if (todayRow.isOpen24h) return true;
    for (const range of rangesOf(todayRow)) {
      const open = timeToMinutes(range.open);
      const close = timeToMinutes(range.close);
      if (open !== null && close !== null && isWithinRangeToday(open, close, vnNow.minutesSinceMidnight)) {
        return true;
      }
    }
  }

  const yesterdayDayOfWeek = (vnNow.dayOfWeek + 6) % 7;
  const yesterdayRow = hours.find((h) => h.dayOfWeek === yesterdayDayOfWeek);
  if (yesterdayRow && !yesterdayRow.isClosed && !yesterdayRow.isOpen24h) {
    for (const range of rangesOf(yesterdayRow)) {
      const open = timeToMinutes(range.open);
      const close = timeToMinutes(range.close);
      if (open !== null && close !== null && isWithinOvernightSpillover(open, close, vnNow.minutesSinceMidnight)) {
        return true;
      }
    }
  }

  return false;
}
