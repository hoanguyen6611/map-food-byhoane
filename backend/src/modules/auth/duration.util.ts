// Minimal duration parser for the small set of formats used in env config
// (e.g. "15m", "30d", "1h") — avoids pulling in the `ms` package for this
// single use. Throws on anything else rather than silently misinterpreting.
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid duration format: "${value}" (expected e.g. "15m", "30d")`,
    );
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
