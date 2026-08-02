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

function timeToMinutes(time: Date | null): number | null {
  if (!time) return null;
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

/**
 * Whether a restaurant is open at `vnNow`, given its weekly `OpeningHour` rows.
 * Handles overnight hours (closeTime < openTime, e.g. 18:00 -> 02:00): a row
 * open past midnight is checked against BOTH its own day (for the evening
 * portion) and the following day (for the early-morning portion still
 * belonging to the previous day's business hours) — see
 * docs/06-database-erd.md §3 OpeningHour business rule.
 */
export function isOpenNow(hours: OpeningHourRow[], vnNow: VnNow): boolean {
  const todayRow = hours.find((h) => h.dayOfWeek === vnNow.dayOfWeek);
  if (todayRow && !todayRow.isClosed) {
    const open = timeToMinutes(todayRow.openTime);
    const close = timeToMinutes(todayRow.closeTime);
    if (open !== null && close !== null) {
      if (close > open) {
        if (
          vnNow.minutesSinceMidnight >= open &&
          vnNow.minutesSinceMidnight < close
        ) {
          return true;
        }
      } else if (close < open) {
        // Overnight: open from `open` until midnight.
        if (vnNow.minutesSinceMidnight >= open) {
          return true;
        }
      } else {
        // open === close is not a meaningful bound (would mean 0 or 24h) —
        // treat as invalid data rather than guessing.
      }
    }
  }

  const yesterdayDayOfWeek = (vnNow.dayOfWeek + 6) % 7;
  const yesterdayRow = hours.find((h) => h.dayOfWeek === yesterdayDayOfWeek);
  if (yesterdayRow && !yesterdayRow.isClosed) {
    const open = timeToMinutes(yesterdayRow.openTime);
    const close = timeToMinutes(yesterdayRow.closeTime);
    if (open !== null && close !== null && close < open) {
      // Yesterday's overnight hours spill into today until `close`.
      if (vnNow.minutesSinceMidnight < close) {
        return true;
      }
    }
  }

  return false;
}
