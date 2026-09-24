# Gap 11 — Image-egress assurance: threat model & residual risk

**Invariant (CLAUDE.md §3):** the raw face image (bytes or a URI/handle to them) lives and
dies on the device. Only *derived cosmetic scores/labels* cross the compliance boundary to
Supabase or the recommendation/chat LLM. This document is the threat model behind the automated
guard `scripts/check-no-image-egress.mjs` (run by `npm run check:no-egress`, wired into CI's
`compliance` job on GitHub and GitLab).

**Not a proof.** These are static, heuristic scans of source text. They raise the cost and the
detection rate of an accidental regression or a careless shortcut. They are not a formal proof of
non-egress and cannot see through dynamic dispatch, native code, or a dependency's own network
calls. Residual risk is enumerated at the end.

## What the guard now checks (two layers)

**Layer 1 — legacy token scan (`findEgress`, unchanged).** Fast substring tripwire for
`.storage`, `upload`, `imageUri`, `photo.path`, `FormData` in the scan-pipeline dirs
(`src/features/capture`, `src/features/read`, `app/(dev)`). Cheap, kept as-is.

**Layer 2 — sink / taint scan (new).** Strips comments and string/template-literal *contents*
first (so a token in a comment or string can neither false-positive nor hide), then:

- **Pipeline rule:** in the guarded dirs, flag any statement where an *image reference* — or a
  variable *tainted* by one — co-occurs with an *egress sink*.
- **Network-layer rule:** in `src/lib` (the layer that legitimately calls the sinks), flag *any*
  reference to an image symbol at all. That layer must only ever carry derived scores.

Image references tracked: `photoUri`, `imageUri`, `photo.path`, `photoPath`, `imageBytes`,
`rawImage`, `base64`, `readAsStringAsync` (file→string = bytes in JS), `frame.toArrayBuffer/…`.
Egress sinks tracked: `supabase.rpc(` and `.from().insert/update/upsert/delete(` (the app's real
write path), `.storage`, `.upload(`, `fetch(`, `XMLHttpRequest`, `WebSocket`,
`navigator.sendBeacon`, `FormData`, `axios`, `console.log/info/warn/error/debug(`, and crash
reporters (`captureException`, `Sentry`, `addBreadcrumb`).

Intra-file **taint**: a variable assigned from an image ref (e.g. `const b64 = await
readAsStringAsync(uri)`) is tracked as image bytes for the rest of the file, and one assignment
hop further (`const payload = { img: b64 }`). This closes the "read to base64 on one line, send
it on the next" split that a per-line token check cannot see.

**Auditable escape hatch:** an inline `// egress-ok: <reason>` suppresses a line. It is grep-able
on its own (`grep -rn 'egress-ok' src`), so every suppression stays visible in review.

## Coverage vs the vectors in scope

| Vector | Before (token scan) | Now |
|---|---|---|
| **Network clients** (`fetch`, XHR, WebSocket, axios, sendBeacon) | only a literal `imageUri`/`FormData` on the line | image ref **or tainted var** reaching any of these sinks |
| **Supabase / storage** | `.storage`, `upload` substrings | `.rpc(`, table `insert/update/upsert/delete`, `.storage`, `.upload(` — the app's *real* write path — with image/tainted arg |
| **FormData / body construction** | `FormData` token only | `FormData` + body built from an image/tainted var (taint follows one hop into an object) |
| **Logging** | not checked | `console.*(imageRef|tainted)` flagged |
| **Analytics / error reporting** | not checked | `captureException`/`Sentry`/`addBreadcrumb` with an image/tainted arg flagged (CLAUDE.md §2: reporter must never attach images) |
| **URI propagation** | keyed on `imageUri` only — misses the real `photoUri`/`uri` | tracks the names actually used + taints derived vars |
| **Temp-file cleanup** | n/a | delete-after-read is enforced by `withImageCleanup` + its unit tests; this guard is complementary — see residual risk #4 |
| **Regressions token-matching misses** | base64→rpc, real var names, string-hiding, network-layer leaks all passed silently | all now caught (see `check-no-image-egress-sinks.test.mjs`) |

Verified by live negative-control: planting a base64→`supabase.rpc` leak (split across two lines)
in `src/features/read/run-read.ts` and an image ref in `src/lib/scans.ts` both trip the guard
(exit 1); the real tree scans clean (exit 0, zero false positives).

## Residual risk (documented, not closed)

1. **Cross-file / cross-function dataflow.** Taint is single-file and follows ~one hop. An image
   passed into a helper in another module, or stored on an object field and read back elsewhere,
   is not tracked. Mitigated by the network-layer rule (the sink layer may not name an image
   symbol at all) and by the small size of the pipeline surface.
2. **Dynamic dispatch / reflection.** `globalThis[fnName](photoUri)`, computed property names, or
   an eval-like path defeat static matching. Low likelihood in this codebase (lint/TS discourage
   it), but real.
3. **Dependencies' own egress.** A third-party module handed the URI could upload it; the guard
   scans first-party source only. Mitigated by `check-no-analytics-sdk` and the deliberately small
   dependency set on the scan path.
4. **Delete-after-read is a separate control.** This guard proves the image is not *sent*; it does
   not itself prove the file is *deleted*. That guarantee lives in `withImageCleanup`
   (`image-lifecycle.ts`) and its tests. A future engine that bypasses `withImageCleanup` would
   not be caught here — consider a companion check that every engine entry routes through it.
5. **Native side.** Frame data handled in native (vision-camera worklets, nitro modules) is
   outside JS static reach.
6. **Suppression abuse.** `// egress-ok` is honored on trust; it is greppable and must be reviewed,
   but the guard cannot force that review.

## If you need to extend it

Add real image-carrying identifiers to `IMAGE_REFS` and real sinks to `SINKS` in
`scripts/check-no-image-egress.mjs`, and a matching positive/negative test in
`scripts/__tests__/check-no-image-egress-sinks.test.mjs`. Keep it dependency-free so CI stays
zero-install. Do **not** add image networking/storage or weaken delete-after-read to make a test
pass.
