// Pure week-strip logic for the Today dashboard. Kept free of React/Date.now so it
// is fully deterministic under test (callers pass `today`).

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** A short, friendly local date like "Jun 9" for scan timelines. */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

export interface WeekDay {
  /** Local calendar day, YYYY-MM-DD. */
  key: string;
  /** Three-letter weekday label. */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  hasScan: boolean;
  /** After today — not yet reachable. */
  isFuture: boolean;
}

/** A date (or ISO string) as its LOCAL calendar day, `YYYY-MM-DD`. */
export function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The Sun→Sat week containing `today`, each day annotated with whether it holds a
 * scan and whether it is today/in the future. `scanDateKeys` are local day keys
 * (see `toDateKey`).
 */
export function buildWeek(today: Date, scanDateKeys: readonly string[]): WeekDay[] {
  const scans = new Set(scanDateKeys);
  const todayKey = toDateKey(today);
  // Sunday that starts this week.
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  return DAY_LABELS.map((label, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = toDateKey(d);
    return {
      key,
      label,
      dayOfMonth: d.getDate(),
      isToday: key === todayKey,
      hasScan: scans.has(key),
      isFuture: key > todayKey,
    };
  });
}
