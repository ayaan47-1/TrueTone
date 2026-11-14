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
it statically parses each pinned function's `deno.json` + `index.ts` and verifies the committed
`deno.lock` actually matches what they currently declare —

- Every bare specifier the source imports (e.g. `@supabase/supabase-js`) resolves through
  `deno.json`'s import map, and that resolved specifier (e.g.
  `npm:@supabase/supabase-js@2.108.2`) must appear in `deno.lock`'s `specifiers` map, in its
  `workspace.dependencies` list, and have a recorded integrity entry under `deno.lock.npm` for
  that exact `package@version`.
- Every direct remote URL import (e.g. `https://esm.sh/stripe@14.19.0`) must have an exact
  matching key in `deno.lock.remote`.
- A missing `deno.lock`, an unrecognized lock schema version (only `"5"` is trusted), or any of
  the above mismatches is a hard failure (`process.exit(1)`), never a silent pass.

This catches the real failure mode the existing pin test can't: someone bumps the version in
`deno.json` (or a CDN import's version string in source) without re-running `deno install` to
regenerate `deno.lock`, so the committed lock silently stops matching what the function actually
declares. `scripts/__tests__/check-edge-locks.test.mjs` has a RED-first regression test for that
exact scenario (deno.json pins `2.108.3`, lock only records `2.108.2`), plus cases for a missing
npm integrity entry, an internally inconsistent `workspace.dependencies`, a stale remote-URL
pin, and an import with no import-map entry at all. It was also run against this repo's real
files with a deliberately mutated `deno.json` (not committed) to confirm it rejects a real, not
just a synthetic, mismatch, then restored.

### What this gate still does NOT prove

**This is a static, offline check of the committed files — it does not run `deno`, `edge-
runtime`, or the Supabase CLI, and it makes no network or deploy call.** It cannot and does not
prove that Supabase's actual deploy path *enforces* the lock at bundle time (the open gate
above). A local `deno` (`2.9.8`, installed via Homebrew this round for inspection only — not
invoked by the shipped script) could in principle run `deno cache --frozen` to make Deno itself
verify a lock during real module resolution, but doing that meaningfully requires resolving
every import against `deno.land`/`esm.sh`/the npm registry — i.e. the "no hosted calls" boundary
this card was dispatched under. That remains the separate, explicitly out-of-scope preflight
called for above, not something this script claims to close.

**So: a function whose lock matches its own declared imports is a necessary condition for a
reproducible deploy, not a sufficient one.** If Supabase's deploy path turns out to ignore
`deno.lock` entirely, this preflight still won't catch that — it only catches the lock drifting
from what the function itself says it needs, which is the part that can regress silently on
every commit regardless of how the deploy mechanism behaves.

## Reproduce

```sh
npm run check:edge-locks
node --test scripts/__tests__/check-edge-locks.test.mjs
node --test scripts/__tests__/edge-function-pins.test.mjs
```
