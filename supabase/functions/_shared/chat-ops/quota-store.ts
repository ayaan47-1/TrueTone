// Atomic quota/cost store contract (gap-9 §3.3, §3.4, §4). The production implementation calls the
// service-role-only RPCs in supabase/migrations/0021_chat_ops.sql; every check-and-write is one
// database transaction, so competing requests cannot over-reserve. Any thrown error = fail closed.
import type { UsageEvent } from './usage-event.ts';

export type Gate = { ok: true } | { ok: false; retryAfterSec: number };

export interface AttemptArgs { userKey: string; ipKey: string | null; userMax: number; ipMax: number }

export interface ReserveArgs {
  /** Verified auth user id: stored only on the reservation row so account deletion cascades. */
  userId: string;
  userKey: string;
  requestId: string;
  reserveMicros: number;
  shortWindowMax: number;
  userDailyCalls: number;
  userDailyMicros: number;
  globalDailyMicros: number;
}
export type ReserveRejection = 'rate' | 'concurrency' | 'user_daily' | 'cost_killed';
export type ReserveResult =
  | { ok: true; reservationId: string }
  | { ok: false; reason: ReserveRejection; retryAfterSec: number };

export interface SettleArgs {
  reservationId: string;
  /** Cost charged against budgets; the full reservation when usage is unavailable. */
  actualMicros: number;
  /** A per-message cap breach sets the persistent cost kill. */
  breach: boolean;
  event: UsageEvent;
}

export interface QuotaStore {
  noteAttempt(a: AttemptArgs): Promise<Gate>;
  reserve(r: ReserveArgs): Promise<ReserveResult>;
  settle(s: SettleArgs): Promise<void>;
}
