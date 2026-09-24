// In-memory QuotaStore with the same semantics as the SQL RPCs in
// supabase/migrations/0021_chat_ops.sql. Test fixture only — production atomicity is the database's.
import type { QuotaStore, ReserveArgs, ReserveResult, SettleArgs, AttemptArgs, Gate } from '../quota-store.ts';

const WINDOW_MS = 10 * 60 * 1000;
const STALE_LEASE_MS = 120 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Reservation {
  id: string; userKey: string; reserved: number; actual: number | null;
  state: 'in_flight' | 'settled'; at: number;
}

export class MemoryQuotaStore implements QuotaStore {
  attempts: { userKey: string; ipKey: string | null; at: number }[] = [];
  reservations: Reservation[] = [];
  events: SettleArgs['event'][] = [];
  costKilled = false;
  constructor(private now: () => number) {}

  private secsToUtcMidnight(): number {
    const t = this.now();
    return Math.ceil((Math.floor(t / DAY_MS) * DAY_MS + DAY_MS - t) / 1000);
  }
  private sameUtcDay(at: number): boolean {
    return Math.floor(at / DAY_MS) === Math.floor(this.now() / DAY_MS);
  }
  private charged(r: Reservation): number { return r.actual ?? r.reserved; }

  async noteAttempt(a: AttemptArgs): Promise<Gate> {
    const since = this.now() - WINDOW_MS;
    const user = this.attempts.filter((x) => x.userKey === a.userKey && x.at > since);
    const ip = a.ipKey ? this.attempts.filter((x) => x.ipKey === a.ipKey && x.at > since) : [];
    const over = user.length >= a.userMax ? user : ip.length >= a.ipMax ? ip : null;
    if (over) return { ok: false, retryAfterSec: Math.ceil((over[0].at + WINDOW_MS - this.now()) / 1000) };
    this.attempts.push({ userKey: a.userKey, ipKey: a.ipKey, at: this.now() });
    return { ok: true };
  }

  async reserve(r: ReserveArgs): Promise<ReserveResult> {
    if (this.costKilled) return { ok: false, reason: 'cost_killed', retryAfterSec: 0 };
    const mine = this.reservations.filter((x) => x.userKey === r.userKey);
    if (mine.some((x) => x.state === 'in_flight' && this.now() - x.at < STALE_LEASE_MS)) {
      return { ok: false, reason: 'concurrency', retryAfterSec: 5 };
    }
    const recent = mine.filter((x) => x.at > this.now() - WINDOW_MS);
    if (recent.length >= r.shortWindowMax) {
      return { ok: false, reason: 'rate', retryAfterSec: Math.ceil((recent[0].at + WINDOW_MS - this.now()) / 1000) };
    }
    const today = mine.filter((x) => this.sameUtcDay(x.at));
    const userSpent = today.reduce((s, x) => s + this.charged(x), 0);
    if (today.length + 1 > r.userDailyCalls || userSpent + r.reserveMicros > r.userDailyMicros) {
      return { ok: false, reason: 'user_daily', retryAfterSec: this.secsToUtcMidnight() };
    }
    const globalSpent = this.reservations.filter((x) => this.sameUtcDay(x.at)).reduce((s, x) => s + this.charged(x), 0);
    if (globalSpent + r.reserveMicros > r.globalDailyMicros) {
      this.costKilled = true;
      return { ok: false, reason: 'cost_killed', retryAfterSec: 0 };
    }
    const id = `res-${this.reservations.length + 1}`;
    this.reservations.push({ id, userKey: r.userKey, reserved: r.reserveMicros, actual: null, state: 'in_flight', at: this.now() });
    return { ok: true, reservationId: id };
  }

  async settle(s: SettleArgs): Promise<void> {
    const r = this.reservations.find((x) => x.id === s.reservationId && x.state === 'in_flight');
    if (!r) throw new Error('reservation-not-in-flight');
    r.state = 'settled';
    r.actual = s.actualMicros;
    if (s.breach) this.costKilled = true;
    this.events.push(s.event);
  }
}
