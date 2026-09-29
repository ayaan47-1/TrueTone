// src/features/account/account-summary.ts
// Pure view-model for the Account tab (v3 video frames t-15/t-17): profile line, shade chip,
// the Orders / Saved / Day-streak stats and the row captions. Every value comes from real app
// state except orders — there is no order history yet (checkout is a mock shell), so the
// order count + "arriving" caption are SAMPLE values shown only in DEMO_MODE builds.
export const SEASONAL_REPORT_SCANS = 5;

/** SAMPLE DATA (demo builds only): no order history exists yet. Matches the v3 video. */
export const SAMPLE_ORDERS = { count: 3, caption: 'Last order arriving Friday' } as const;

export interface AccountSummaryInput {
  username: string | null;
  savedCount: number;
  streak: number;
  scanCount: number;
  shadeName: string | null;
  demo: boolean;
}

export interface AccountStat {
  value: string;
  label: string;
}

export interface AccountSummary {
  displayName: string;
  handle: string | null;
  initial: string;
  shadeLabel: string;
  stats: readonly AccountStat[];
  ordersCaption: string;
  savedCaption: string;
  seasonalCaption: string;
}

function savedCaption(n: number): string {
  if (n <= 0) return 'Nothing saved yet';
  return `${n} ${n === 1 ? 'product' : 'products'}`;
}

export function accountSummary(input: AccountSummaryInput): AccountSummary {
  const { username, savedCount, streak, scanCount, shadeName, demo } = input;
  const displayName = username ?? 'Your account';
  const orders = demo ? SAMPLE_ORDERS.count : 0;
  return {
    displayName,
    handle: username ? `@${username}` : null,
    initial: (username ?? 'TrueTone').charAt(0).toUpperCase(),
    shadeLabel: shadeName ?? 'No shade yet',
    stats: [
      { value: String(orders), label: 'Orders' },
      { value: String(Math.max(0, savedCount)), label: 'Saved' },
      { value: String(Math.max(0, streak)), label: 'Day streak' },
    ],
    ordersCaption: demo ? SAMPLE_ORDERS.caption : 'No orders yet',
    savedCaption: savedCaption(savedCount),
    seasonalCaption: `${Math.min(Math.max(0, scanCount), SEASONAL_REPORT_SCANS)} of ${SEASONAL_REPORT_SCANS} scans logged`,
  };
}
