# routine-chat operations and cost controls

Implements the engineering core of the gap-9 contract (`hive/deliverables/truetone-gap09-chat-ops-cost-controls.md`).
**Chat is disabled by default.** It only serves traffic when every setting below is present and valid.
The budget and limit values are the contract's *proposed* values; the product owner must approve
them in the release record before production enablement.

## Request order (every step before the provider call fails closed)

1. Config / kill switch → generic `503 chat unavailable` (`kill_switch` log line).
2. `Authorization` present and verified with the auth server (`auth.getUser(token)`) → `401`.
3. Body schema: `scanId` (UUID), `message` (1–2,000 chars), `history` ≤ 20 turns of exactly
   `{role: 'user'|'assistant', content: 1–4,000 chars}`; any other key (e.g. `userId`, `price`) → `400`.
4. All-attempts limit (12 / user / rolling 10 min) and hashed-IP backstop (30 / 10 min) → `429` + `Retry-After`.
5. Medical refusal → referral, no reservation, no provider call.
6. Caller-scoped (RLS) scan lookup → `404` if not the caller's.
7. Aggregate estimate (system + history + message, ⌈chars/3⌉ + framing) > 3,000 tokens → `413`.
8. Atomic reservation (`chat_reserve`): persistent cost kill → `503`; one in-flight call per user,
   5 provider-eligible / 10 min, 20 calls or $0.40 / user / UTC day → `429` + `Retry-After`;
   global $25.00 / UTC day → sets the persistent cost kill, `503`.
9. One Anthropic call (`maxRetries: 0`, 30 s timeout, pinned model, `max_tokens` from config).
10. Output guard; usage beyond caps or any cache usage → cost kill + `503`.
11. Usage event persisted and unused reservation released (`chat_settle`) **before** the reply returns;
    a write failure → `503` with the reply withheld.

Any quota-store, auth-server, or scan-lookup failure → generic `503`.

## Server-only settings (Supabase Edge Function secrets)

| Key | Initial value | Rule |
|---|---|---|
| `CHAT_ENABLED` | `false` | Must be exactly `true` to serve. Manual emergency stop. |
| `CHAT_COST_KILLED` | `false` | `true` = off. Must be `true` or `false`. Mirrors the DB state for operators. |
| `CHAT_MODEL_ID` | `claude-sonnet-4-6` | Only the pinned ID is accepted; any alias/other model disables chat. |
| `CHAT_MAX_OUTPUT_TOKENS` | `600` | 1–600. |
| `CHAT_MAX_INPUT_TOKENS` | `3000` | 1–3,000 (estimated). |
| `CHAT_RESERVE_USD` | `0.0200` | Must cover the input/output ceiling at the configured prices. |
| `CHAT_USER_DAILY_CALLS` / `CHAT_USER_DAILY_USD` | `20` / `0.40` | Per user, UTC day. |
| `CHAT_GLOBAL_DAILY_USD` | `25.00` | Whole environment, UTC day. |
| `CHAT_SHORT_WINDOW_MAX` / `CHAT_ATTEMPT_WINDOW_MAX` / `CHAT_IP_WINDOW_MAX` | `5` / `12` / `30` | Rolling 10 minutes. |
| `CHAT_PRICING_REVISION` | e.g. `anthropic-sonnet-4-6-2026-09-24` | Recorded on every usage event. |
| `CHAT_PRICE_INPUT_USD_PER_MTOK` / `CHAT_PRICE_OUTPUT_USD_PER_MTOK` | `3.00` / `15.00` | Official list price for the pin; re-check at every change. |
| `CHAT_CONFIG_REVISION` / `CHAT_FUNCTION_REVISION` / `CHAT_ENVIRONMENT` | release-record values | `[A-Za-z0-9._:-]{1,64}`. |
| `CHAT_USER_KEY_SECRET` | ≥ 32 random chars | HMAC key for user/IP keys. Never stored in the DB; rotating it rotates all keys. |

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must also be
present; if any is missing chat is disabled. The service-role client is used only for the
`chat_*` RPCs, never for the scan lookup.

## Database (`supabase/migrations/0021_chat_ops.sql`)

Service-role only (RLS on, no policies, no client grants): `chat_ops_state` (persistent cost kill),
`chat_ops_audit`, `chat_attempts`, `chat_reservations` (lease + daily ledger), `chat_usage_events`
(append-only, numeric/enumerated columns only), `chat_usage_daily` (de-identified aggregate).
Nightly `chat_ops_retention_sweep` (03:15 UTC) rolls events older than 30 days into the aggregate and
deletes them; aggregates older than 13 months are deleted. Account deletion cascades
`auth.users → chat_reservations → chat_usage_events`.

**Re-enable after a cost kill** (human operator only, after reviewing usage and incident notes):

```sql
select public.chat_set_kill_state(false, 'manual_reenable', 'incident_owner', '<incident-id>');
```

## Not done here (needs owners/operators)

- Alert/page delivery and the dashboard (§5.1): the data exists in `chat_usage_events`,
  `chat_reservations`, `chat_ops_state` and `chat_ops_audit`; no alert transport is wired.
- The `kill_switch`/rate/refusal outcomes are reason-code log lines, not DB rows.
- `supabase/tests/chat_ops.test.sql` has not been run against a local database yet.
- All §2 deployment-gate items (legal processor approval, policy/consent update, release record,
  named incident owners, value approvals) remain open.
