// QuotaStore backed by the service-role RPCs in 0021_chat_ops.sql. Any error or unexpected shape
// throws 'quota-store-unavailable', which the handler turns into a generic 503 (fail closed).
import type { QuotaStore, ReserveRejection } from './quota-store.ts';

export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

const REJECTIONS: readonly string[] = ['rate', 'concurrency', 'user_daily', 'cost_killed'];

function unavailable(): never { throw new Error('quota-store-unavailable'); }

async function firstRow(rpc: Rpc, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await rpc(fn, args);
  if (error || !Array.isArray(data) || typeof data[0] !== 'object' || data[0] === null) unavailable();
  return data[0] as Record<string, unknown>;
}
const seconds = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : unavailable());

export function supabaseQuotaStore(rpc: Rpc): QuotaStore {
  return {
    async noteAttempt(a) {
      const row = await firstRow(rpc, 'chat_note_attempt', { p_user_key: a.userKey, p_ip_key: a.ipKey, p_user_max: a.userMax, p_ip_max: a.ipMax });
      if (row.allowed === true) return { ok: true };
      if (row.allowed === false) return { ok: false, retryAfterSec: seconds(row.retry_after_s) };
      return unavailable();
    },
    async reserve(r) {
      const row = await firstRow(rpc, 'chat_reserve', {
        p_user_id: r.userId, p_user_key: r.userKey, p_request_id: r.requestId, p_reserve_micros: r.reserveMicros,
        p_short_window_max: r.shortWindowMax, p_user_daily_calls: r.userDailyCalls,
        p_user_daily_micros: r.userDailyMicros, p_global_daily_micros: r.globalDailyMicros,
      });
      if (row.status === 'ok' && typeof row.reservation_id === 'string') return { ok: true, reservationId: row.reservation_id };
      if (typeof row.status === 'string' && REJECTIONS.includes(row.status)) {
        return { ok: false, reason: row.status as ReserveRejection, retryAfterSec: seconds(row.retry_after_s) };
      }
      return unavailable();
    },
    async settle(s) {
      const { error } = await rpc('chat_settle', {
        p_reservation_id: s.reservationId, p_actual_micros: s.actualMicros, p_breach: s.breach, p_event: s.event,
      });
      if (error) unavailable();
    },
  };
}
