const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A JS Date -> 'YYYY-MM-DD' for its UTC calendar day. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as 'YYYY-MM-DD' using the device's local calendar day. */
export function todayIso(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** '2026-11-17T00:00:00.000Z' or '2026-11-17' -> '17 Nov 2026' (read in UTC, no timezone shift). */
export function formatDay(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM-DD' plus or minus whole days. */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return toIsoDay(new Date(Date.UTC(y, m - 1, d + delta)));
}
