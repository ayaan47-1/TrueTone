# Cofounder handoff — TrueTone R1 (unified release)

> **Audited state:** branch `release/tt-r1-unified` @ `4e693f9`, diffed against `origin/main`.
> This is a practical "where do I edit X" map, not a rules doc — read [`CLAUDE.md`](../CLAUDE.md)
> first for what you must never do (biometric/data rules, the compliance boundary). Read
> [`README.md`](../README.md) for the product pitch and full setup. This file is for: "I want to
> change the Shop tab / add a Community feature / touch the design system — which files?"

Every claim below was checked against the code on this branch, not copied from an older doc — see
"How this was verified" at the bottom for the exact commands.

---

## 1. What actually ships in this release

`release/tt-r1-unified` is an integration branch: eight feature branches were merged in, in this
order (`git log --first-parent`):

1. Identity + Community + "My Daily Routine" (Tasks 11–13) — new social/routine features
2. Today-tab decluttering (removed the week strip + skin-feel diary from For You)
3. Design-system foundations (`AppHeader`, `Button` tap-target tests)
4. Scanner tasks 04–10 (capture overlay merge, shade share flow)
5. Commerce navigation tasks 08–09 (Community tab wired in, replacing Trend)
6. Age-gate one-time DOB via native date picker (task 01)
7. In-app version/build marker on Account
8. A QA reconciliation pass + one EAS config tweak (`camera-demo` autoIncrement)

**The app's home screen is Shop, not Today.** The tab bar is
**Shop · For You · Community · Account** (`app/(tabs)/_layout.tsx`, `unstable_settings.initialRouteName
= 'shop'`). There is no Trend tab and no bottom-tab Scan — the shade scan is a camera icon in the
For You header that pushes `/scan-gate` → the full-screen camera route. **This wiring predates this
release** (it was already on `origin/main`); this release adds the identity/community/routine/share
layers on top of it. `README.md` and `docs/ARCHITECTURE.md` on `main` describe an older Today/
Routine/Scan/Trend/You layout — that description was already stale before this branch started, and
both docs are corrected as part of this handoff.

---

## 2. Setup (condensed — full version in `README.md`)

```bash
npm install                       # .npmrc sets legacy-peer-deps=true
npx supabase start                # local Postgres + auth
cp .env.example .env               # paste ANON_KEY from `npx supabase status`
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # routine-chat Edge Function only
npx expo start --dev-client        # Expo Go CANNOT load this app (vision-camera, nitro-image, blur)
```

You need a **physical device with a dev build installed** for anything camera-related — see §6
before you touch EAS.

---

## 3. File-by-feature map

### Navigation

| Want to... | Edit |
|---|---|
| Change tab order / labels / icons | `app/(tabs)/_layout.tsx` (registers routes), `src/components/ui/GlassTabBar.tsx` (renders the pill bar; `TabKey` union is `'shop' \| 'index' \| 'community' \| 'you'`), `src/components/ui/tab-icons.tsx` (glyphs) |
| Change the landing tab | `unstable_settings.initialRouteName` in `app/(tabs)/_layout.tsx` (currently `'shop'`) |
| Change what happens before the tabs (age gate / consent / region block) | `app/_layout.tsx` (mounts the `Guard`), `src/lib/routing-guard.ts` (pure `nextRoute()` decision function — edit here, not the component, if you're changing gate logic) |
| Change the scan entry point | `app/(tabs)/index.tsx` (For You header's `CameraGlyph` → `/scan-gate`); the camera itself lives outside the tab navigator at `app/scan/` |

### Design system ("Mist")

| Want to... | Edit |
|---|---|
| Add/change a shared primitive (button, card, header, text field) | `src/components/ui/` — `AppHeader.tsx` (new shared screen header, 48pt tap targets), `Button.tsx`, `GlassCard.tsx`, `GlassSheet.tsx`, `TextField.tsx`, `Typography.tsx` |
| Change colors/type scale/glass tokens | `src/theme/tokens.ts` |
| Change safe-area / responsive sizing | `src/components/ui/use-responsive.ts`, `use-insets.ts` |
| See what "shared header" usage looks like | `src/components/ui/__tests__/AppHeader.test.tsx` — not yet adopted on every screen; check call sites before assuming it's everywhere |

### Onboarding / age gate (DOB)

| Want to... | Edit |
|---|---|
| Change the DOB input UI | `src/features/age-gate/AgeGate.tsx` — **this release replaced the old free-entry DOB field with the native iOS/Android date picker**, and added a **local, one-time verification cache** so a user isn't re-asked their DOB every launch |
| Change the age math | `src/features/age-gate/age.ts` (`computeIs18Plus`) — pure, unit-tested, untouched by this release |
| Change what's persisted | Nothing new server-side — the DOB is still **never persisted**; only `is_18_plus` + a verification timestamp. The new local cache is device-only. |

### Scanner + share

| Want to... | Edit |
|---|---|
| Change the capture screen's bottom controls | `src/features/capture/Capture.tsx` — **this release merged two separate bottom overlays into one frosted container** (restyled to match "Mist"/beauty-tech visual language) |
| Change the post-scan share flow | `src/features/shade/ScanShareCard.tsx` (the branded off-screen card that gets captured — depth/undertone/finish only, never the photo or raw scores), `src/features/shade/use-scan-share.ts` (captures the card to a temp PNG via `react-native-view-shot`, opens the native OS share sheet via `expo-sharing`) |
| Change the result screen's share entry point | `src/features/shade/ShadeMatchResult.tsx` |
| **Compliance note** | The share card renders only *derived* shade descriptors + branding — never the source photo, a photo URI, or raw scores (`CLAUDE.md` §3). Don't add a screenshot-of-camera-output shortcut here. |

### For You (home feed, not the tab-bar home)

| Want to... | Edit |
|---|---|
| Change what's on the For You screen | `app/(tabs)/index.tsx` — greeting + `AffirmationCard` + two product rails + the routine summary widget. **The week strip and skin-feel diary were removed this release** (`src/features/today/WeekStrip.tsx` and the diary module still exist in the tree but are no longer rendered here — check for other call sites before deleting) |
| Change the affirmation card / its share button | `src/features/today/AffirmationCard.tsx` — this release added attribution text + a download link to the shared image, and enforced a 48pt tap target |
| Change the ranked product rails | `src/features/foryou/for-you-profile.ts` (`resolveForYouProfile`, `pickedForYourShade`, `featuredProducts`), `src/features/foryou/ProductRail.tsx`, `src/features/foryou/FindYourShadeCard.tsx` (pre-scan neutral state) |
| Change the routine summary card shown here | `src/features/routine/components/RoutineSummaryWidget.tsx` → `RoutineSummaryCard.tsx` (see "Routines" below) |

### Shop

| Want to... | Edit |
|---|---|
| Change the shelf / ranking | `app/(tabs)/shop.tsx` (assembles the `MatchProfile` from the scan + Setup prefs — pre-scan renders a neutral shelf), `src/features/shop/ShopList.tsx`, `src/features/match/{scoring,product-catalog,fit-reason,sort}.ts` |
| Change the bag/checkout entry | `src/features/checkout/BagBar.tsx` (appears above the shelf once the bag has items, routes to `/checkout`), `src/features/checkout/bag-store.ts`. **Not part of this release's diff** — pre-existing, and not documented in `docs/ARCHITECTURE.md` yet; treat as a known doc gap, not something this release changed. |
| Change filter tabs | Per the git log, filter order was changed to `all/lips/eyes/face` this release — check `src/features/shop/` for the `FILTERS` constant. |

### Community / profile

| Want to... | Edit |
|---|---|
| Change the Community screen (Routines/Feed tabs) | `src/features/community/CommunityScreen.tsx` — no props, rendered directly by `app/(tabs)/community.tsx` |
| Change seeded posts/routines | `src/features/community/community-seed.ts` (**local seed data only, no backend table, no network** — `SEED_POSTS` / `SEED_ROUTINES`) |
| Change feed interactions (like/save/share) | `src/features/community/use-community-feed.ts` |
| Change post/routine card UI | `src/features/community/components/{PostCard,RoutineCard,CreatorHeader,EngagementBar,MediaPlaceholder,ProductTagDrawer}.tsx` — media is a **local color-swatch placeholder**, never a real image/video URL |
| Change the username/avatar identity seam | `src/features/identity/community-profile-types.ts` (validation + shape), `community-profile-repository.ts` (persistence — **avatar is a local file URI in this release; no cross-device avatar storage/bucket exists yet**), `use-community-profile.ts` (the hook `you.tsx` calls) |
| Change the DB-side username rule | `supabase/migrations/0021_profile_identity.sql` — **the database is the sole uniqueness authority** (case-insensitive unique index); the client-side regex in `community-profile-types.ts` is a UX nicety only, keep both in lockstep if you change the format |
| Wire the Account screen | `app/(tabs)/you.tsx` — username/avatar editor + the new `nativeVersionLabel()` build marker (`src/lib/app-version.ts`, reads `expo-application`, returns `null` in Expo Go so nothing half-broken renders) |

### Routines ("My Daily Routine" — Task 13, new this release)

Two different things are both called "routine" in this codebase — don't conflate them:

| Concept | Where | What it is |
|---|---|---|
| **Skincare routine engine** (older, step 6) | `src/features/recommend/` | The deterministic scores→routine recommender + scoped chat. Untouched this release. |
| **My Daily Routine** (new, Task 13) | `src/features/routine/` | A user-facing **AM/PM product logger** — the user taps which shop-catalog products they applied each day. On-device only (AsyncStorage), no backend table. |

| Want to... | Edit |
|---|---|
| Change the logger UI (Account screen) | `src/features/routine/components/RoutineLogger.tsx` |
| Change the logging logic / streak math | `src/features/routine/routine-logic.ts`, `routine-types.ts`, `use-daily-routine.ts` |
| Change storage | `src/features/routine/routine-storage.ts` (AsyncStorage, per-user key) |
| Change what happens on "publish to Community" | `src/features/routine/routine-publish.ts` — builds a `CommunityRoutine` from the day's logged products and appends it to a **single on-device list** (`truetone.community.published.v1`), which `CommunityScreen` merges **ahead of** the seeded routines via `use-published-routines.ts` |
| Change the For You summary widget | `src/features/routine/components/{RoutineSummaryWidget,RoutineSummaryCard}.tsx` |

---

## 4. Architecture seams worth knowing before you edit across a boundary

- **Compliance boundary is unchanged and non-negotiable.** Nothing in this release's new code
  (identity, community, routine, share) touches the raw face image or a raw read dimension — see
  `CLAUDE.md` §3. The share flow captures a *rendered card* of derived descriptors, never the photo.
- **Routing vs. feature ownership.** Route files under `app/` are kept thin and props-free by
  convention (see the comment in `app/(tabs)/community.tsx`) specifically so routing changes and
  feature changes don't collide across owners. If you're renaming a route, you likely don't need to
  touch the feature module, and vice versa.
- **Two independent "product list" consumers.** Shop (`match/product-catalog`), the routine logger,
  and Community's tagged products all point at the **same** catalog ids — there is one source of
  truth (`src/features/match/product-catalog.ts`). Don't invent a second product list for a new
  surface.
- **Client-side checks mirror DB constraints, never replace them.** Username format/uniqueness is
  the clearest example (`community-profile-types.ts` regex vs. the Postgres `CHECK` + unique index
  in migration `0021`). If you change one, change both, and remember the DB wins.
- **`origin/main` in this worktree may be behind what's actually on GitHub `main`.** The diff
  numbers in this doc were computed against the `origin/main` ref present in this worktree at audit
  time; re-run `git fetch && git diff origin/main..HEAD --stat` before trusting them again.

---

## 5. Focused validation commands (verified to actually run + pass on `4e693f9`)

Full suite:
```bash
npm test
# Test Suites: 161 passed, 161 total
# Tests:       870 passed, 870 total
```

Per-area, so you don't wait on the whole suite while iterating on one feature:

```bash
npx jest src/components/ui        # design system — 9 suites, 60 tests
npx jest src/features/age-gate    # DOB gate — 2 suites, 10 tests
npx jest src/features/shade       # shade derive + share flow — 5 suites, 31 tests
npx jest src/features/foryou      # For You rails — 3 suites, 11 tests
npx jest src/features/shop        # shop shelf — 3 suites, 11 tests (add --forceExit; a fake-timer leak
                                   # in one test leaves an open handle and jest prints a harmless warning)
npx jest src/features/community   # Community screen + seed — 2 suites, 11 tests
npx jest src/features/identity    # username/avatar seam — 1 suite, 10 tests
npx jest src/features/routine     # My Daily Routine — 5 suites, 31 tests
npx jest src/lib/__tests__/app-version   # version marker — 1 suite, 6 tests
```

Non-Jest checks (unchanged this release, still required before any PR):
```bash
npm run check:compliance   # no ad/analytics SDK
npm run check:no-egress    # raw image can't reach a network/log sink
npx supabase test db       # pgTAP — needs local Supabase running
```

There is **no CI run to point to for this branch** — verify locally with the commands above before
merging; don't claim "CI passed" without having run it yourself.

---

## 6. Build-profile safety — read before running any `eas build`

`eas.json` defines six profiles. Two of them have caused a **real incident** and must be treated
with care:

- **`camera-demo` (live face-detection prototype) MUST be direct-installed to one owned device
  only — never distributed via internal TestFlight, an external group, or a public link.**
  On 2026-09-03, a `camera-demo` build was auto-distributed to the cofounder through internal
  TestFlight (documented incident, `docs/ops/camera-on-testflight-compliance.md`). The profile is
  now configured `distribution: "internal"` with no `submit` block specifically so it is
  **structurally incapable** of reaching App Store Connect/TestFlight — but the ad-hoc install is
  still scoped to registered device UDIDs, so **do not register a third device or share the
  install QR/link beyond the two named principals** (residual human discipline, not enforced by
  config).
- **`testflight-demo` is the no-camera build** approved for the external TestFlight group —
  `EXPO_PUBLIC_CAMERA_DEMO` is unset, so it never has live camera code paths. It's the *only*
  profile that should ever reach that group.
- **`development` / `device-test`** carry real Supabase + Stripe **test-mode** keys directly in
  `eas.json` (committed, plaintext). These are publishable/anon-scoped keys designed to be public
  client-side, so this is normal for Expo — but don't copy this pattern for a secret key, and
  don't point these profiles at a production Supabase project.
- **`production`** has no env block — it reads from `.env`/EAS secrets, not `eas.json`.

Full incident writeup and the enforcement rationale: `docs/ops/camera-on-testflight-compliance.md`.
This handoff doesn't change any EAS config — if a profile needs to change, that's a separate,
reviewed task.

---

## 7. Known doc gaps not fixed by this handoff (told to you straight, not silently patched)

- `AGENTS.md` still describes the **pre-makeup-pivot** product (skin-appearance-only, no shade
  match, no makeup vocabulary) and has not been updated in this pass — it duplicates `CLAUDE.md`'s
  compliance rules but is a generation behind on product description. Treat `CLAUDE.md` as current;
  don't use `AGENTS.md`'s product framing to make a decision.
- `docs/ARCHITECTURE.md`'s per-module tables for `checkout/`, `premium/`, and this release's new
  `foryou/`, `community/`, `identity/`, `routine/` modules were added/corrected as part of this pass
  where they were flatly wrong (the routing table, the "makeup layer is unwired" section); the
  deep-dive tables for older modules (capture/read pipeline, recommend/chat, personalize, Supabase
  backend, fairness-eval) were **not** re-audited line-by-line — they still describe the code
  accurately as far as this pass checked, but weren't the target of this task.
- A separate branch chain (`5b6a7f2` and earlier: Stripe checkout production-verifiable, premium
  entitlement integration-ready, chat metering/rate-limit/cost controls) is **not** an ancestor of
  `release/tt-r1-unified` — those "gap" fixes are real commits sitting on another branch, not part
  of what you're looking at here. Don't assume checkout/premium got hardened by this release.

---

## How this was verified

- Branch/commit: `git -C <repo> log --oneline --graph --all` (first-parent log used to establish
  merge order), `git rev-parse HEAD` → `4e693f95cee0536d651379f36a64eb72644f31fa`.
- Diff scope: `git diff origin/main..HEAD --stat` → 74 files changed.
- Tab wiring / TabKey union: read directly from `app/(tabs)/_layout.tsx` and
  `src/components/ui/GlassTabBar.tsx` on this branch (not inferred from README, which was stale).
- Test counts: `npm test` and the per-directory `npx jest <path>` commands listed in §5, run against
  this checkout on 2026-09-26 — all commands and numbers above are the actual output, not carried
  over from an older doc.
- EAS incident: `docs/ops/camera-on-testflight-compliance.md`, dated entry "2026-09-03 — camera-demo
  build 4 auto-distributed to cofounder."
