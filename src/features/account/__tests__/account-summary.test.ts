import { accountSummary, SAMPLE_ORDERS } from '../account-summary';

const base = { username: 'ayaan', savedCount: 1, streak: 4, scanCount: 3, shadeName: 'Warm Sand', demo: false };

describe('accountSummary', () => {
  it('uses the username for the display name and @handle', () => {
    const s = accountSummary(base);
    expect(s.displayName).toBe('ayaan');
    expect(s.handle).toBe('@ayaan');
    expect(s.initial).toBe('A');
  });

  it('falls back when no username exists yet', () => {
    const s = accountSummary({ ...base, username: null });
    expect(s.displayName).toBe('Your account');
    expect(s.handle).toBeNull();
    expect(s.initial).toBe('T');
  });

  it('shows the shade name, or "No shade yet" before a scan', () => {
    expect(accountSummary(base).shadeLabel).toBe('Warm Sand');
    expect(accountSummary({ ...base, shadeName: null }).shadeLabel).toBe('No shade yet');
  });

  it('builds the Orders / Saved / Day streak stats from real state outside demo mode', () => {
    expect(accountSummary(base).stats).toEqual([
      { value: '0', label: 'Orders' },
      { value: '1', label: 'Saved' },
      { value: '4', label: 'Day streak' },
    ]);
    expect(accountSummary(base).ordersCaption).toBe('No orders yet');
  });

  it('uses the marked sample order values only in demo mode', () => {
    const s = accountSummary({ ...base, demo: true });
    expect(s.stats[0]).toEqual({ value: String(SAMPLE_ORDERS.count), label: 'Orders' });
    expect(s.ordersCaption).toBe(SAMPLE_ORDERS.caption);
    expect(SAMPLE_ORDERS.caption).toBe('Last order arriving Friday');
  });

  it('pluralises the saved-items caption', () => {
    expect(accountSummary(base).savedCaption).toBe('1 product');
    expect(accountSummary({ ...base, savedCount: 2 }).savedCaption).toBe('2 products');
    expect(accountSummary({ ...base, savedCount: 0 }).savedCaption).toBe('Nothing saved yet');
  });

  it('reports seasonal-report progress out of 5 scans, capped', () => {
    expect(accountSummary(base).seasonalCaption).toBe('3 of 5 scans logged');
    expect(accountSummary({ ...base, scanCount: 9 }).seasonalCaption).toBe('5 of 5 scans logged');
  });

  it('takes the first whole character for the initial (emoji-safe)', () => {
    expect(accountSummary({ ...base, username: '\u{1F600}x' }).initial).toBe('\u{1F600}');
  });

  it('shows "Member since" only in demo builds (no join date is stored yet)', () => {
    expect(accountSummary(base).profileLine).toBe('@ayaan');
    expect(accountSummary({ ...base, demo: true }).profileLine).toBe('@ayaan · Member since 2026');
    expect(accountSummary({ ...base, username: null }).profileLine).toBeNull();
  });

  it('hides the seasonal caption when the scan count is unknown', () => {
    expect(accountSummary({ ...base, scanCount: null }).seasonalCaption).toBeUndefined();
  });
});
