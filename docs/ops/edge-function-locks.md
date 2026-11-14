# Edge Function dependency lock gate

Three Supabase Edge Functions pin an exact `supabase-js` version through a per-function
`deno.json` import map and commit the resulting `deno.lock`: `stripe-webhook`,
`create-payment-intent`, `routine-chat`. `scripts/__tests__/edge-function-pins.test.mjs` proves
each one's imports are exact-version pins (no floating `esm.sh/@supabase/supabase-js` CDN
import, no bare semver range) and that a `deno.lock` is committed at all.

## Deployment-time lock enforcement is still unresolved

**Do not treat the committed lockfiles or passing pin checks as proof that a deployment
enforces dependency integrity.** The inspected
[CLI source at v2.116.0](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/shared/functions/deploy.ts)
builds an API source upload without explicit lockfile handling. Its Docker path delegates
bundling to `edge-runtime` without an explicit frozen-lock flag. This does not establish what
the remote bundler enforces. The
[Supabase dependency guide](https://supabase.com/docs/guides/functions/dependencies) recommends
function-specific `deno.json` files but gives no lock-enforcement guarantee.

Before a future Edge Function deployment, a separate reviewed preflight must prove that the
exact CLI and bundler reject a missing, changed or integrity-mismatched dependency against the
committed lockfile, with tool versions, commands and results recorded. Until then this gate
remains open — HAG-245 (below) narrows it but does not close it. The 0043 profile-avatar
migration rollout hold is unchanged; this work neither applies migrations nor changes hosted
configuration.

## What HAG-245 adds: a local, offline lock-consistency preflight

`npm run check:edge-locks` (`scripts/check-edge-locks.mjs`) goes further than "a lock exists":
it discovers every deployable function, walks its real module graph, and verifies the committed
lock actually matches what that graph currently declares.

**Discovery** enumerates every `supabase/functions/*/index.ts` (skipping `_shared`) and asserts
the result against an explicit `EXPECTED_FUNCTIONS` list in the script — zero functions found,
or a set that doesn't match, is a hard failure, not a silent zero-item pass. Each discovered
function must resolve its lock config one of three ways: its own `deno.json` (`stripe-webhook`,
`create-payment-intent`, `routine-chat`); a shared import map declared in
`supabase/config.toml`'s `[functions.<name>].import_map` (`catalog-reconcile`,
`shopify-catalog-webhook`, both via `supabase/functions/catalog-import-map.json`); or an explicit
`ALLOWLIST` entry in the script carrying a reason (currently empty — every discovered function
resolves through a real lock, see below). Anything else fails closed.

**Parsing** uses the TypeScript compiler API (`typescript`, already a devDependency) to walk
`index.ts`'s real AST — static `import`, `export ... from`, `import type`, and a dynamic
`import()` with a string-literal specifier — and recurses into every *value* relative import it
reaches, so a bare specifier only ever imported by a `_shared/` file (this repo's `zod`, reached
only through `_shared/catalog/*.ts`) is still found. A dynamic `import()` with a non-literal
specifier fails closed rather than being silently skipped. A relative `import type` is not
required to resolve — it is erased before Deno ever loads the module graph (one `_shared/match`
file in this repo omits its extension for exactly this reason), but a *remote or bare* `import
type` specifier is still collected and checked, since resolving its type declaration still
touches the dependency graph a lock would need to pin.

**Validation** checks lock entries by content, not just key presence: the version `deno.json`
pins must be exact semver, `deno.lock`'s recorded version for that specifier must equal it
(not just exist), and `npm`/`remote` integrity hashes must be non-empty and hash-shaped rather
than merely present.

This catches the real failure modes the previous round's regex extractor and presence-only
checks couldn't: a version bump in `deno.json` (or a CDN import string) that nobody re-ran
`deno install` for; a double-quoted or dynamically-imported dependency the old single-quote
regex never saw at all; and a hand-edited lock entry with the right key but a wrong or empty
value. `scripts/__tests__/check-edge-locks.test.mjs` (31 tests) has a RED-first regression test
for each of these, plus the discovery/allowlist/expected-set paths. It was also re-run against
this repo's real files with several deliberate mutations (a version bump, a double-quoted
unlocked import, a literal dynamic unlocked import) to confirm it rejects a real, not just a
synthetic, mismatch — each reverted after.

### Resolved: `catalog-reconcile` and `shopify-catalog-webhook` now have a committed shared lock

A prior round of this check surfaced a real, previously-invisible gap: `catalog-reconcile` and
`shopify-catalog-webhook` only ever pin `zod` (via `catalog-import-map.json`, reached
transitively through `_shared/catalog/*.ts`, never directly in their own `index.ts`), and no
`deno.lock` was committed anywhere for that shared import map. The previous round's
`deno.json`-presence-based discovery had silently never looked at these two functions at all;
once discovery was fixed it correctly found and correctly failed them. This was deliberately
**not** papered over with an `ALLOWLIST` entry — the allowlist exists for a function that
genuinely has no remote/npm dependency to lock, not for one with an unaddressed gap.

With a boundary exception approved for this one case (reaching only the public npm registry /
`deno.land` to resolve `zod`; still no `supabase functions deploy`, no hosted Supabase calls, no
secrets), the lock was generated locally and committed at `supabase/functions/deno.lock`
(schema version `"5"`), covering **`zod@4.4.3`**
(`sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==`).
`npm run check:edge-locks` now passes for all 5 discovered functions against this repo's real
state. `scripts/__tests__/catalog-edge-locks.test.mjs` is a dedicated real-repo integration test
(no synthetic fixtures) proving, via `check-edge-locks.mjs`'s own exported functions: `config.toml`
resolves both functions through the shared import map rather than a per-function `deno.json`;
each function's real module graph reaches `zod` transitively through `_shared/catalog/*.ts`; the
committed lock validates against that graph; and the lock's recorded version/integrity match the
exact pin in `catalog-import-map.json`.

### What this gate still does NOT prove

**This is a static, offline check of the committed files — it does not run `deno`, `edge-
runtime`, or the Supabase CLI, and it makes no network or deploy call.** It cannot and does not
prove that Supabase's actual deploy path *enforces* the lock at bundle time (the open gate
above). **The shipped `check-edge-locks.mjs` script itself never invokes `deno` or makes a
network call** — it only reads and statically validates committed files. A local `deno`
(`2.9.8`, installed via Homebrew for inspection) was separately invoked by hand, once, under an
explicit boundary exception scoped to this one case (generating the catalog `zod` lock above,
reaching only the npm registry / `deno.land`) — that exception does not extend to deploy-time
enforcement. Verifying *that* would mean running `deno cache --frozen` (or the real Supabase/
edge-runtime bundler) against every import at deploy time, which remains the separate,
explicitly out-of-scope preflight called for above, not something this script claims to close.

**So: a function whose lock matches its own declared imports is a necessary condition for a
reproducible deploy, not a sufficient one.** If Supabase's deploy path turns out to ignore
`deno.lock` entirely, this preflight still won't catch that — it only catches the lock drifting
from what the function itself says it needs, which is the part that can regress silently on
every commit regardless of how the deploy mechanism behaves.

## Reproduce

```sh
npm run check:edge-locks
node --test scripts/__tests__/check-edge-locks.test.mjs
node --test scripts/__tests__/catalog-edge-locks.test.mjs
node --test scripts/__tests__/edge-function-pins.test.mjs
```
