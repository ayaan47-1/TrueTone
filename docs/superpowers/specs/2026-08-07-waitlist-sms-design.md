# Waitlist phone capture + SMS consent — design

**Date:** 2026-08-07
**Status:** approved, ready for implementation planning
**Scope:** capture only. Sending is a separate, later project (see "Out of scope").

---

## Problem

The waitlist at <https://truetone-1rw.pages.dev> collects an email address and an 18+/US
attestation. We want to also reach signups by text when the app launches, which means
collecting phone numbers.

Launch is months out — build-order step 5 (on-device verification of capture + read) is still
open. But TCPA consent cannot be obtained retroactively, so the consent captured from the next
signup onward has to already be correct.

## Why SMS is not "email with another column"

CAN-SPAM, which governs the existing email list, is a notice-and-opt-out regime with
effectively no private right of action. TCPA is the opposite:

- **$500–$1,500 per message**, uncapped, with a private right of action.
- Illinois is among the most active venues for these suits.
- Delivery requires **A2P 10DLC brand + campaign registration** with the carriers, which has a
  lead time, a monthly cost, and depends on the LLC that `CLAUDE.md` §4 already flags as pending.

Marketing texts need **prior express written consent**: a clear and conspicuous disclosure plus
an affirmative act specific to SMS.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope split | Capture now, send later | Consent can't be retrofitted; a broadcast pipeline built now sits unexercised for months and starts the 10DLC clock early |
| Form UX | Optional field + its own unchecked checkbox | An affirmative act specific to SMS — the pattern that withstands challenge. Email signup still works without it |
| Consent proof | Timestamp + exact wording (no IP/UA) | Covers the realistic dispute — *what* was agreed and *when* — without contradicting the minimize-everything line the site makes to visitors |
| Consent storage | Live columns + append-only hashed event log | Unsubscribe still deletes the number, but the receipt survives, so an opt-out doesn't erase the proof that consent existed |

## Compliance boundary

Unchanged. This holds an email address, a phone number, and an attestation — no face image, no
scan, no score, no health inference. It sits entirely outside the `CLAUDE.md` §3 boundary, as the
waitlist already does. The retention arm still applies.

---

## Data model — `0016_waitlist_sms.sql`

### Columns on `waitlist`

```sql
alter table public.waitlist
  add column phone               text,
  add column sms_consent_at      timestamptz,
  add column sms_consent_version text,
  add column sms_invited_at      timestamptz;   -- idempotency seam for the future blast
```

**E.164, US only, excluding service codes.** A plain `^\+1[2-9][0-9]{2}[2-9][0-9]{6}$` accepts
`+19115550100` and `+14115550100`; N11 codes are assignable as neither area code nor exchange:

```sql
alter table public.waitlist add constraint waitlist_phone_e164 check (
  phone is null or (
    phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    and substring(phone from 3 for 3) !~ '^[2-9]11$'  -- NPA is not 411/911/etc.
    and substring(phone from 6 for 3) !~ '^[2-9]11$'  -- nor is the exchange
  )
);
```

**A number and its consent record are inseparable.** There is no path to a textable number with
no proof behind it:

```sql
alter table public.waitlist add constraint waitlist_phone_consent_paired
  check (num_nonnulls(phone, sms_consent_at, sms_consent_version) in (0, 3));
```

**Partial unique index** — many rows may have no phone, but no number is stored twice:

```sql
create unique index waitlist_phone_key on public.waitlist(phone) where phone is not null;
```

### Consent versions

The exact wording lives in the database, not only in the repo, so it is reconstructable from a
dump alone — the artifact that would actually be handed to counsel.

```sql
create table public.waitlist_sms_consent_versions (
  version    text primary key,          -- 'sms-2026-08-07'
  body       text not null,             -- the exact sentence shown on the page
  created_at timestamptz not null default now()
);

alter table public.waitlist add constraint waitlist_sms_consent_version_fk
  foreign key (sms_consent_version) references public.waitlist_sms_consent_versions(version);
```

```sql
revoke all on public.waitlist_sms_consent_versions from anon, authenticated, service_role;
grant select on public.waitlist_sms_consent_versions to service_role;
```

Append-only (same trigger shape as `0003_consent_immutability.sql`). The FK means a forged
request cannot record consent to wording that never existed. `anon` needs no privileges — the
RPC reaches the table as `security definer`.

### Event log

Survives unsubscribe; holds no phone number.

```sql
create table public.waitlist_sms_events (
  id              uuid primary key default gen_random_uuid(),
  phone_hash      text     not null,               -- hmac(E.164, pepper, 'sha256')
  pepper_version  smallint not null default 1,
  event           text     not null check (event in ('granted','revoked','sent')),
  consent_version text,
  created_at      timestamptz not null default now()
);
create index waitlist_sms_events_hash_idx on public.waitlist_sms_events(phone_hash);

revoke all on public.waitlist_sms_events from anon, authenticated, service_role;
grant select on public.waitlist_sms_events to service_role;
```

`pepper_version` exists so a rotated — or wrongly restored — pepper doesn't silently render every
existing hash unverifiable at exactly the moment they're needed.

Append-only, but stricter than `consent_log`: both `UPDATE` and `DELETE` raise, since there is no
identity to null out. See "Append-only vs. retention" for the one exception.

### The pepper

**Revised 2026-08-08 — Vault dropped.** The original design read the pepper from
`vault.decrypted_secrets`. Working through the threat model showed Vault buys nothing here, so
the dependency is removed in favour of a zero-grant table:

```sql
create table public.waitlist_secrets (
  name  text primary key,
  value text not null
);
alter table public.waitlist_secrets enable row level security;
revoke all on public.waitlist_secrets from anon, authenticated, service_role;
-- No grants to anyone. Only the table owner reads it, which is exactly what a
-- security-definer function runs as.

insert into public.waitlist_secrets(name, value)
values ('sms_pepper', encode(gen_random_bytes(32), 'hex'));
```

**Why this is not a downgrade.** Vault's advantage is that a database dump alone does not reveal
the secret. But the pepper only ever needed to survive a leak of the *events table on its own* —
anyone holding a full dump already has `waitlist.phone` in plaintext and has no reason to reverse
hashes. Against the threat that matters, a table `anon`, `authenticated`, and `service_role`
cannot read is equivalent.

**What it buys:** no extension dependency, identical behaviour local and hosted, and no
verification spike blocking implementation. Generating the pepper inside the migration also means
it always exists and differs per environment — a pepper set manually after deploy is one that
will eventually be missing, at which point `join_waitlist` either breaks signups or silently
skips the log.

**Threat model, restated:** the pepper protects against a leak of the events table alone. Anyone
with full database access obtains both the pepper and the phone numbers, so it buys nothing
there. Partial exposure is the likelier failure, so it is still worth having — but it is not
encryption of the list.

---

## RPC behavior

### `join_waitlist` is replaced, not overloaded

Adding a 5-argument version alongside the existing 2-argument one leaves PostgREST with two
candidates for a two-key call; it answers `PGRST203` rather than choosing. **Drop the old
function; create one function with defaults.**

```sql
join_waitlist(p_email text, p_attested boolean,
              p_phone text default null,
              p_sms_consent boolean default false,
              p_sms_consent_version text default null)
```

Defaults also make deploy order irrelevant: a visitor holding a cached copy of the old `app.js`
sends two keys, hits the defaults, and still joins. `.pages.dev` caches aggressively, so this
matters.

### Server-side normalization

`public.normalize_us_phone(raw)` strips non-digits, drops a leading `1`, and returns `+1` + ten
digits, or `null` if the result isn't ten digits. The `CHECK` constraint becomes the backstop
rather than the enforcement — otherwise dedup depends on the browser having done its job, and a
client that didn't normalize gets a confusing rejection.

### Consent gates the number

If the box is unticked the number is discarded, not rejected. A typo'd number must not cost the
visitor their email signup. An **invalid** number with consent ticked does raise, so nobody walks
away believing they will get a text when they won't; the client validates first, so this is a
fallback rather than the normal experience.

### Three conflict paths, one indistinguishable `204`

```sql
insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
values (v_email, true, v_phone, ...)
on conflict (email) do update
  set phone = excluded.phone,
      sms_consent_at = excluded.sms_consent_at,
      sms_consent_version = excluded.sms_consent_version
  where public.waitlist.phone is null and excluded.phone is not null
returning phone into v_stored;
```

- **Returning visitor adds a number** → the `WHERE` upgrades a row that has none.
- **Someone who knows your email submits a different number** → the `WHERE` is false; your number
  is not replaceable by anyone who knows your address.
- **Number already on the list under another email** → `unique_violation`, caught; the email is
  stored alone and the phone discarded. Saying anything else would confirm the number is present.

`RETURNING ... INTO v_stored` is load-bearing: it is how we know the number was *actually*
written. Without it the third case logs a consent receipt for a number we never stored — a record
claiming consent to text someone we cannot text. Only a confirmed write produces a `granted`
event.

### Unsubscribe leaves a receipt

```sql
delete from public.waitlist where unsubscribe_token = p_token
returning phone into v_phone;
-- if v_phone is not null: insert a 'revoked' event
```

The number goes; the proof that they revoked, and when, stays.

### Append-only vs. retention

The trigger that makes `waitlist_sms_events` trustworthy also blocks the job that keeps it from
growing forever. Resolution — a transaction-local escape hatch:

```sql
-- in the trigger
if tg_op = 'DELETE' and coalesce(current_setting('app.waitlist_sweep', true), '') <> 'on' then
  raise exception 'waitlist_sms_events is append-only' using errcode = 'P0001';
end if;

-- in waitlist_retention_sweep(), before the delete
perform set_config('app.waitlist_sweep', 'on', true);   -- true => dies with the transaction
```

**Cost, acknowledged:** "append-only" becomes "append-only except through one named function."
Anything able to `set_config` and delete could exploit it — but that is `service_role` or higher,
which could drop the trigger outright anyway. The alternative is an unbounded log.

### Retention

`waitlist_retention_sweep()` gains a third arm: `waitlist_sms_events` older than **4 years**,
matching the federal TCPA limitations period (28 U.S.C. §1658). The log is the defense; it should
outlive the phone number but not the claim window. Phone numbers continue to die with their row
on the existing 90-day-post-invite / 3-year schedule.

---

## Front end

### Form

```html
<div>
  <label for="phone">Phone <span class="opt">(optional)</span></label>
  <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"
         placeholder="(555) 123-4567" />
</div>
<label class="check">
  <input id="sms-consent" name="sms-consent" type="checkbox"
         data-consent-version="sms-2026-08-07" />
  <span>Text me when TrueTone launches. ~1-2 messages. Msg &amp; data rates may
        apply. Reply STOP to opt out. Consent isn't required to join.</span>
</label>
```

**The canonical string is ASCII-only, deliberately.** No en-dashes, no curly apostrophes. Two
reasons, both of which bite silently: byte-for-byte matching across the page, the migration seed,
and the DB row cannot tolerate a typographic substitution introduced by an editor; and any
character outside GSM-7 forces an SMS into UCS-2, cutting the segment from 160 characters to 70
and doubling the cost of the launch blast. The canonical module lives at
`src/content/sms-consent.js` and is the single source the page, the migration, and the test all
read from.

The 18+/US attestation stays a separate checkbox. The disclosure links to the privacy policy, as
CTIA guidelines expect at the point of consent.

**If the box is unticked, the number is never transmitted.** The browser has it; we do not receive
it. Cheaper than deciding what to do with a number we should not hold.

### `web/waitlist-client.js`

Stays pure and fully unit-tested. Additions:

- `parsePhone(raw)` → `{ status: 'blank' | 'ok' | 'invalid', e164? }`. Three states rather than
  `string | null`: blank and malformed need different treatment, and a nullable return conflates
  them.
- `SMS_CONSENT_VERSION`, sent with the request so the receipt records what the visitor saw.
- `buildRequest(config, { email, phone, smsConsent })` — a signature change to a module already
  under test, so its specs are rewritten first (RED) before the module changes.
- `messageFor` gains an SMS-aware success line ("we'll email *and* text you once, at launch"),
  preserving the existing fail-closed default.

`web/app.js` wires the field, validates inline with field-specific messages, and manages focus,
matching how the email field already behaves.

### Copy gate

`scripts/check-waitlist-copy.mjs` currently enforces cosmetic-claim boundaries. It gains the rule
that matters here: **a page collecting phone numbers must carry the TCPA disclosure.**

```js
// If the page has a tel input, these four are mandatory, not stylistic.
const SMS_DISCLOSURES = [
  { id: 'frequency', pattern: /~?\s*1\s*-\s*2\s+(msg|message)s?\b/i },
  { id: 'rates',     pattern: /msg\s*&(amp;)?\s*data rates may apply/i },
  { id: 'stop',      pattern: /\breply STOP\b/i },
  { id: 'optional',  pattern: /consent isn't required/i },
];
```

The frequency pattern matches the phrase directly rather than requiring "message" and a count in
a particular order — the disclosure reads "~1-2 messages", so an order-dependent pattern would
reject the very copy it exists to protect.

Deleting the disclosure while leaving the input then fails the build — the failure mode to expect
from a future redesign.

### Drift control

The disclosure exists in three places: the page, the migration seed, and the DB row. Rather than
codegen, the canonical string lives in one committed module; the migration hardcodes the same
literal; and a test asserts the migration file contains it byte-for-byte. Editing the wording
without minting a new version fails that test.

### Policies

- `privacy.md` — the waitlist section gains phone: optional, launch notification only, never sold
  or shared, STOP to opt out.
- `retention.md` — two lines: the number dies with its row on the existing schedule; the
  numberless consent receipt is kept 4 years.

---

## Testing

TDD throughout: failing test first, minimal implementation, refactor.

### pgTAP — `supabase/tests/waitlist.test.sql`

| Case | Expected |
|---|---|
| `+19115550100`, `+14115550100` | rejected (N11 area code) |
| Phone present, consent columns null | rejected (paired constraint) |
| New email, phone already on the list | `204`, email stored, phone dropped, **no** `granted` event |
| Known email, row already has a phone, different number submitted | `204`, existing number untouched |
| Known email, row has no phone | number added, `granted` logged |
| `update` / `delete` on `waitlist_sms_events` | raises |
| Same, inside `waitlist_retention_sweep()` | permitted, and only past 4 years |
| `leave_waitlist` on a row with a phone | row gone, `revoked` logged |
| `anon` privileges on both new tables | none |
| Unknown `sms_consent_version` | rejected by FK |
| Two formats of the same number | identical `phone_hash` |

### Node — `test/web/`, `scripts/__tests__/`

- `parsePhone` across `5551234567`, `(555) 123-4567`, `+1 555 123 4567`, `15551234567`,
  `+445551234567`, `555123456`, letters, empty string.
- `buildRequest` omits the phone entirely when consent is false.
- The copy gate fails a tel-input page missing each of the four disclosures.
- The migration seed matches the canonical disclosure module byte-for-byte.

---

## Out of scope

This project ends with numbers and consent stored correctly. **Not included:** Twilio or any SMS
vendor, an email sending vendor, an Edge Function, A2P 10DLC registration, a STOP webhook, the
Reassigned Numbers Database check, or a quiet-hours scheduler.

`sms_invited_at` and the `sent` event type exist as seams for the send project. Nothing writes
them yet.

## Constraints the send project inherits

Recorded here so they are not rediscovered late.

- **Reassigned numbers.** The FCC's Reassigned Numbers Database check is the only safe harbor
  against texting someone who inherited a consenting user's number. This is *heightened* by the
  capture-now/send-later split: every number ages between consent and send, and that gap is
  exactly when reassignment happens. The check keys off `sms_consent_at`.
- **Quiet hours.** Texts are restricted to 8am–9pm recipient local time. A single national blast
  must land in a window safe for every US zone — roughly 2pm–9pm ET once Alaska and Hawaii are
  included — or be staggered.
- **Consent staleness.** Consent does not legally expire, but aggregators grow uncomfortable past
  ~6–12 months, and stale consent is what plaintiffs attack. If the gap runs long, send a
  re-confirmation before the blast.
- **Landline / VoIP.** Not detectable at signup; needs a carrier lookup before sending. Texting
  landlines wastes money and degrades delivery reputation.
- **A2P 10DLC.** Brand + campaign registration must be complete before anything sends, and it
  depends on the LLC.
- **CAN-SPAM.** The first invite email still needs a valid physical postal address.

## Accepted risks

- **Timing side-channel.** A caught `unique_violation` takes measurably longer than a clean
  insert, so a patient attacker could in principle probe whether a number is on the list despite
  every response being an identical `204`. Closing it means avoiding the exception path entirely.
  Accepted: the payoff is "this number signed up for a skincare app," and the effort to exploit is
  out of proportion. Recorded as a decision, not an oversight.
- **The retention escape hatch** on an append-only table, as described above.
