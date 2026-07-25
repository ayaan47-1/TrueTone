# Scan-Accuracy Pipeline — Design

**Date:** 2026-07-25
**Status:** Approved direction (founder), ready for implementation planning
**Build-order position:** hardens step 5 (guided capture + on-device read); prerequisite for the
trained-model track
**Companion specs:** `2026-06-22-cv-read-engine-design.md` (the engine this hardens),
`2026-06-16-truetone-fairness-eval-design.md` (the harness this extends),
`2026-07-02-trained-model-track-design.md` (the track this unblocks)

---

## 1. What this is

Make the scan itself accurate: real face-region placement, illumination-robust scoring, a gate that
refuses images it cannot read honestly, and a measurement instrument that proves any of it worked.

**Constraints this design was written under (founder decisions, 2026-07-25):**

- **Output stays cosmetic-appearance only.** A wider cosmetic vocabulary is wanted, but that is the
  *next* sub-project; this one does not add dimensions.
- **No data spend.** No licensed or commissioned face dataset. Everything here is buildable and
  testable without a single consented photo.
- **Reuse the existing capture detector.** No new face-data vendor (no ML Kit still-image API), so no
  CLAUDE.md §6 escalation.
- **Hardware available:** physical Android (Fold 7) now; physical iPhone once the LLC / Apple
  Developer Organization enrollment lands (scaffold iOS ahead of it).

**The reframe that makes this tractable without data:** accuracy cannot be measured without ground
truth, but **invariance and response can**. A read that returns different scores for the same face
under different light is wrong in a way we can detect, quantify, and fix today.

## 2. Findings that motivate the work

Each is a verified fact about `main` as of 2026-07-25, not an assumption.

### F1 — The capture detector is not running

`src/features/capture/use-frame-metrics.ts:57` sets `FRAME_PROCESSORS_INSTALLED = false`, and
`useFrameMetrics` defaults to `simulate: !FRAME_PROCESSORS_INSTALLED`. Both real signals — the
`react-native-vision-camera-face-detector` output and the luma worklet — are switched off. The
quality gate currently runs on `SIM_TIMELINE`, a scripted three-step sequence.

**No missing package blocks this.** The in-file comment (`use-frame-metrics.ts:53-56`) says the real
frame processors need `react-native-vision-camera-worklets`; that is stale, describing the
vision-camera v3/v4 `worklets-core` model. On the installed v5.0.11, `useFrameOutput` is exported by
vision-camera itself, and every native dependency it requires is already in `package.json`:
`react-native-nitro-modules`, `react-native-nitro-image`, `react-native-worklets`. Enabling the real
signals is a flag flip plus a fresh dev build — the rebuild is required because these are native
modules, not because anything must be added. The stale comment should be corrected in the same change.

**Everything else in this spec depends on turning this on first.**

### F2 — The face is never actually located for the read

`facesToMetrics()` (`src/features/capture/face-metrics.ts:44`) receives real detector bounds and
returns only `faceCenteredness` and `faceFraction`. The rect itself is dropped.

Consequently `detectFaceBbox()` (`src/features/read/detect-bbox.ts:26`) returns a hardcoded centered
rectangle — 70% × 85% of the frame — and every region (forehead, cheeks, periocular, infraorbital,
T-zone) is placed by fixed proportion off that guess (`cv/calibration.ts` `REGION_PROPORTIONS`).

**The installed detector package already solves this, via an API the project has not used.**
`react-native-vision-camera-face-detector@2.0.1` exports `useImageFaceDetector` /
`createImageFaceDetector`, whose `detectFaces(image: string | { uri: string }): Face[]` runs on a
**still image** — the captured photo — not a preview frame. Each returned `Face` carries:

- `bounds` in the photo's own coordinate space (no preview→photo transform needed);
- `contours` — `FACE`, `LEFT_CHEEK`, `RIGHT_CHEEK`, `LEFT_EYE`, `RIGHT_EYE`, `NOSE_BRIDGE`,
  `NOSE_BOTTOM`, eyebrow and lip polygons — gated behind `runContours` (**default `false`**);
- `landmarks` — single points for eyes, cheeks, nose base, mouth, ears (`runLandmarks`, default
  `false`);
- `pitchAngle`, `rollAngle`, `yawAngle` — head pose, always present.

`detect-bbox.ts:14-16` records this upgrade path as deferred, describing it as "a new face-data
dependency that needs sign-off per CLAUDE.md §6". **That description is inaccurate and the item is
now resolved** — see §3a.

### F3 — Three dimensions use absolute thresholds

Five of the eight dimensions are already illumination- and tone-relative by design:
`redness`, `darkSpots`, `darkCircles` subtract the CIELAB cheek baseline (`cv/baseline.ts`), which
cancels a *global* colour cast because the baseline is sampled under the same light; `hydration` and
`texture` use `microContrast` = Laplacian ÷ mean luma (`cv/sampling.ts:88`), a Weber-relative measure.

Three did not get that treatment:

| Dimension | Current measure | Failure mode |
|---|---|---|
| `pores` | `localContrastDensity(…, thr: 0.06)` — absolute Δluma threshold | Brighter image clears the threshold more often ⇒ more "pores". Deep tones carry smaller absolute contrast ⇒ **systematically fewer pores detected**. Tone-fairness defect. |
| `fineLines` | `gradientEnergy` — mean absolute \|Δluma\| | Scales directly with exposure and skin lightness. Same tone-fairness defect. |
| `oiliness` | `CAL.oiliness.lumaThr = 0.8` — absolute luma | An underexposed photo has no pixels above 0.8 ⇒ oiliness reads 0 regardless of actual shine. |

`cv/calibration.ts:5` already marks these constants `PROVISIONAL`.

The existing synthetic fairness self-test does not catch F3: `eval/fairness/self-test-images.ts`
paints flat solid tones, so it never exercises contrast scaling.

### F4 — Downscaling aliases the texture signal

`downscaleRgba()` (`src/features/read/decode-rgb.ts:40`) is nearest-neighbour. Reducing a ~3000px
photo to a 512px working edge point-samples roughly every sixth pixel and discards the rest. That
aliases exactly the high-frequency detail `texture`, `pores`, and `fineLines` exist to measure.

### F5 — EXIF orientation is not applied

`jpeg-js` does not apply EXIF orientation, and `decodeJpegToRgb` does not either. This is currently
invisible because the bbox is centered and near-symmetric; the moment regions are placed off a real
rect, a sideways decode puts "forehead" on an ear.

### F6 — Non-uniform illumination is unhandled

The cheek baseline is a median over *both* cheeks, so a left-right luminance gradient from side
lighting does not cancel. The shadowed side reads as excess `darkCircles` and `darkSpots`.

### F7 — Stale documentation

`2026-07-02-trained-model-track-design.md` §5.3 lists `decodeToRgb` as outstanding. It is
implemented (`decodeJpegToRgb`, via `jpeg-js`), just unverified on a physical device. This spec
supersedes that item; the companion spec should be amended when this work lands.

## 3. Architecture

### Current

```
preview → useFrameMetrics (SIMULATED) → evaluateQuality → captureReducer → takePhoto
  → runRead(uri) → decodeJpegToRgb [nearest-neighbour → 512px]
      → detectFaceBbox [hardcoded centered rect]
      → scoreFromRgb → deriveRegions → sampleBaseline → 8 dimensions → recordScan
```

### Proposed

```
preview → useFrameMetrics (REAL: face detector + luma/chroma worklet)
    ├→ facesToMetrics → FrameMetrics (+ pose: yaw, roll)             ← bounds only, 'fast'
    └→ computeLumaStats + computeChromaStats                          ← clipping, colour temp, balance
  → evaluateQuality (hardened) → captureReducer → takePhoto
  → CaptureContext { lightStats }
  → runRead(uri, ctx)
      → detectFacesOnStill(uri)   ── device ── MLKit still detector, runContours: true
      → decodeJpegToRgb  [AREA-AVERAGED → 512px, EXIF orientation applied]
      → faceGeometry(face, photoSize, workingSize)
                                  ── pure ── contours → Regions; uniform scale to working space
      → normalizeIlluminant(rgb)  ── pure ── skin-locus estimate → adapt to D65 → flatten shading
      → scoreFromRgb(canonical, regions) → ReadResult + captureQuality band
      → recordScan
```

The compliance boundary is unchanged. All new processing is on-device inside `withImageCleanup`; no
new vendor (§3a); the raw image still dies on the phone.

### The `CaptureContext` contract

Detecting on the still collapses this to almost nothing — the geometry fields the analytic transform
needed (`faceRect`, `previewSize`, `photoSize`, `mirrored`, `orientation`) are all obsolete, because
the detector reports in the photo's own space. What remains is the lighting summary the gate already
computed, carried forward so the read can band its own quality without recomputing it:

```ts
interface CaptureContext {
  lightStats: { clipping: number; cct: number; imbalance: number };
}
```

It is optional at the `runRead` boundary — `runRead(uri, ctx?)` — so the existing call path and the
`__DEV__` stub fallback keep working unchanged, and a missing context degrades to today's behaviour
(§7). It is held in memory only, never persisted; it dies with the image inside `withImageCleanup`.

### New and modified modules

| Module | Kind | Purpose |
|---|---|---|
| `capture/face-metrics.ts` | modify, pure | surface head pose (yaw, roll) alongside the derived scalars |
| `capture/chroma-metrics.ts` | new, pure | clipping fraction, colour temperature, shading imbalance |
| `capture/quality-gate.ts` | modify, pure | four new checks (three light, one pose) + hints |
| `capture/use-frame-metrics.ts` | modify, device | ✅ frame processors enabled; publish chroma + pose |
| `read/detect-faces-still.ts` | new, device | `createImageFaceDetector` on the photo, `runContours: true` |
| `read/face-geometry.ts` | new, pure | contours → `Regions`; uniform scale photo → working space |
| `read/detect-bbox.ts` | modify, pure | consume detected bounds; keep `approximateFaceBbox` as fallback |
| `read/decode-rgb.ts` | modify | area-averaged resample; apply EXIF orientation |
| `read/cv/resample.ts` | new, pure | area-averaged downscale (extracted from `decode-rgb`) |
| `read/cv/illuminant.ts` | new, pure | skin-locus estimation, chromatic adaptation, shading flattening |
| `read/cv/dimensions/{pores,fineLines,oiliness}.ts` | modify, pure | absolute → relative measures |
| `eval/render/face.ts` | new, pure | physically-grounded synthetic face renderer |
| `eval/invariance/` | new, pure | four fail-closed axes + report writer |
| `app/(dev)/bbox-overlay` | new, device, dev-only | draws mapped bbox + regions onto the captured photo |
| `supabase/migrations/0013_capture_quality.sql` | new | quality-band column + `record_scan` RPC change (§5a) |
| `lib/scans.ts` | modify | pass and read back the quality band |

### 3a. Design decision — detect on the still, with contours

**Founder decision, 2026-07-25: approved.** Run `createImageFaceDetector` on the captured photo with
`runContours: true`, and derive regions from the returned contour polygons.

**Why this is not a CLAUDE.md §6 crossing.** §6 gates adding "any SDK, vendor, or API that can access
face / skin / score / health data". Google MLKit is already in the bundle and already processing face
data on-device through the live `useFaceDetectorOutput` path. This is an unused API surface of a
vendor that already holds exactly this access, reading a file instead of a frame buffer — same
library, same device, same data, no new party. Nothing leaves the phone; the call sits inside
`withImageCleanup` and the photo is deleted immediately after. No new dependency is added to
`package.json`. The note at `detect-bbox.ts:14-16` calling it "a new face-data dependency" was
written before the package exposed this API and should be corrected when the code changes.

**What this replaces.** The earlier draft of this spec modelled the geometry analytically — preview
aspect-fill crop → photo frame → uniform downscale, with front-camera mirroring and EXIF rotation —
because the detector was believed to work only on live frames. That transform composed four
error-prone steps, each capable of mis-placing regions silently, and it was the highest-risk item in
the design. Detecting on the still removes it: bounds and contours arrive in the photo's own
coordinate space, leaving a single uniform scale to the 512 px working image.

**Division of labour between the two detectors:**

| | Live preview (`useFaceDetectorOutput`) | Captured still (`createImageFaceDetector`) |
|---|---|---|
| Purpose | drive the quality gate in real time | locate the face and its regions for the read |
| Options | bounds only, `performanceMode: 'fast'` | `runContours: true` |
| Why | contours are documented as more expensive and single-face-only; the gate needs only presence, centering, distance, and pose | one-shot cost is irrelevant post-capture, and precision is the entire point |

Head pose (`yawAngle`, `rollAngle`) is available on the live path at no extra cost and feeds the
hardened gate (§5).

**EXIF consistency is now the load-bearing detail** (F5). MLKit resolves orientation when reading an
image URI; `jpeg-js` does not. If the detector reports coordinates in EXIF-corrected space while our
decoded buffer is in raw space, every region lands wrong — and, as before, silently. The decode and
the detector **must** be made to agree, and that agreement is verified on-device by the overlay, not
assumed. This is the single most important thing to check on the first physical run.

The dev-only overlay screen therefore remains **part of the work, not an optional extra**: it draws
the detected bounds, the contour polygons, and the derived regions back onto the captured photo.
Seeing them land correctly on the Fold 7 is the acceptance criterion for piece 2.

### 3b. Region derivation from contours

`deriveRegions` gains a contour-driven path and keeps the proportional one as fallback. Both return
the same `Regions` shape, so `score-from-rgb.ts` and every dimension are unchanged — the improvement
is entirely in *where* the rectangles land.

| Region | From contours | Today |
|---|---|---|
| `cheekL` / `cheekR` | inset bounding box of `LEFT_CHEEK` / `RIGHT_CHEEK` polygons | fixed 20%×18% at (15%, 55%) of the bbox |
| `forehead` | above `LEFT_EYEBROW_TOP` ∪ `RIGHT_EYEBROW_TOP`, clipped to the `FACE` polygon | fixed 50%×15% at (25%, 5%) |
| `periocularL/R` | outer margin of `LEFT_EYE` / `RIGHT_EYE` | fixed 20%×12% |
| `infraorbitalL/R` | below `LEFT_EYE` / `RIGHT_EYE`, above the cheek polygon | fixed 18%×8% |
| `tZone` | `NOSE_BRIDGE` → `NOSE_BOTTOM` span, widened, unioned with the forehead strip | fixed central 20%×45% strip |

Two properties must hold, and both are unit-testable against synthetic contour inputs:

1. **Every derived region stays inside the `FACE` polygon.** A region that spills onto hair,
   background, or a shadowed jaw edge poisons the measurement it feeds — and `sampleBaseline` in
   particular must sample skin, since every tone-relative dimension is defined against it.
2. **Regions remain non-overlapping where the current proportions are non-overlapping** (`tZone` is a
   central strip; cheeks flank it; infraorbital sits above the cheeks — `cv/calibration.ts:14`).

**Fallback chain**, each step failing open to the next: contours present and valid → contour regions;
face detected but no contours → proportional regions off the detected bounds; no face detected →
`approximateFaceBbox` and today's behaviour exactly.

This is where the accuracy gain actually lands. A cheek rectangle placed by fixed proportion on a
narrow, wide, or off-centre face samples partly non-skin, and every tone-relative dimension inherits
that error through the baseline.

## 4. Illumination design

### 4a. Make the three absolute dimensions relative

- `pores` → Weber threshold: Δluma ÷ local luma, replacing the absolute `thr: 0.06`.
- `fineLines` → gradient energy ÷ local luma.
- `oiliness` → specular detection relative to the skin baseline L\* and the estimated illuminant
  chromaticity, replacing the absolute `lumaThr: 0.8`.

Pure, host-testable, no device and no data required. This closes two live tone-fairness defects (F3)
and is the highest value-per-unit-risk change in the track. `CAL` entries are re-ranged accordingly;
the constants remain `PROVISIONAL` and empirically ungrounded until real data exists.

### 4b. Chromatic adaptation to canonical D65

Estimate the scene illuminant, adapt the image, then score. This protects the chromaticity-based
dimensions from strong casts and — more importantly — makes cross-scan comparison valid, which the
trend feature (build-order step 7) depends on.

> **Grey-World must not be used, and neither must max-RGB/white-patch.**
>
> On a selfie the face fills the frame. Grey-World therefore estimates the illuminant as the average
> colour of *the skin*, then corrects it toward neutral — desaturating and lightening deep skin. It
> would encode the exact bias this product exists to eliminate, silently and systematically. This is
> a hard prohibition, not a preference.

**Use skin-locus estimation instead.** Human skin chromaticity across Fitzpatrick I–VI lies on a
tight, known locus in log-chromaticity space, because it varies principally along melanin and
haemoglobin axes rather than arbitrarily. Estimate the illuminant as the shift that places the
observed face chromaticity onto the canonical skin locus, **explicitly projecting out the melanin
direction** so tone remains a free parameter. Apply the result as a von Kries / Bradford chromatic
adaptation to D65. Pure math, tone-preserving by construction.

### 4c. Flatten the shading field

Fit a low-order (planar, optionally quadratic) luminance field over the skin regions and divide it
out, so a left-right lighting gradient stops masquerading as `darkCircles` and `darkSpots` on the
shadowed side (F6).

### What normalization cannot fix

Clipped highlights are unrecoverable — once pixels saturate, the texture beneath them is gone.
Extreme colour temperature pushes chromaticity into a regime where sRGB gamma makes adaptation
non-linear and unreliable. Both are **rejected at the gate** (§5), not corrected.

## 5. Gate hardening

`chroma-metrics.ts` computes, from a downsampled chroma grid published by the same frame worklet:

- **clipping fraction** — share of face-region pixels at or near saturation;
- **colour temperature** — estimated correlated colour temperature of the scene;
- **shading imbalance** — left/right region luma ratio.

Three new `evaluateQuality` checks, with copy that is strictly about *light*, never about skin:

| Condition | Hint |
|---|---|
| clipping above threshold | "Too much glare — turn away from the light" |
| colour temperature outside ≈[2700, 7500] K | "Try more neutral light" |
| shading imbalance beyond threshold | "Light's coming from one side" |
| \|`yawAngle`\| or \|`rollAngle`\| beyond threshold | "Face the camera straight on" |

The pose check comes free: `yawAngle` and `rollAngle` are on every `Face` the live detector already
returns, with no extra option and no extra cost. It matters because a turned head foreshortens one
cheek — which both skews `sampleBaseline` and makes the left/right shading imbalance check fire for
geometric rather than lighting reasons.

The gate **fails closed**: refusing to scan is the safe direction for a user-facing reading.

All three thresholds are provisional until tuned on hardware (sequencing step 7); they are added to
the existing `THRESHOLDS` constant in `quality-gate.ts` so tuning never edits `evaluateQuality`.

**What crosses the compliance boundary:** a coarse `captureQuality: 'good' | 'fair' | 'poor'` band
persisted alongside the scan, so the trend engine can avoid comparing a high-quality scan against a
poor one. `'good'` = all checks pass with margin; `'fair'` = passes but within margin of a threshold;
`'poor'` = would not have passed (reachable only via the legacy path, since the gate fails closed).
Derived metadata, not an image, and deliberately three-valued rather than a continuous score so it
carries no reconstructable detail about the scene. **The face rect and the raw `lightStats` are not
persisted** — they exist only for the duration of the read, inside `withImageCleanup`. This is the
minimum crossing that serves the trend feature.

### 5a. Persisting the band — backend work this implies

`recordScan` calls the `record_scan` RPC (`src/lib/scans.ts:26`), and `scans` is a migrated table
(latest: `supabase/migrations/0012_routine_feedback.sql`). Adding the band is therefore not a
client-only change:

- **`0013_capture_quality.sql`** — add a nullable `capture_quality` column constrained to
  `('good','fair','poor')`; nullable so every pre-existing scan stays valid and readable.
- **`record_scan` RPC** — add `p_capture_quality` with a `NULL` default, so the existing call
  signature keeps working during rollout.
- **RLS** — the new column inherits the table's existing per-user policy; no new policy needed. The
  retention/`pg_cron` deletion job needs no change, since the column lives on a row already covered.
- **pgTAP** — extend the existing suite: column exists and is constrained, the RPC accepts and
  round-trips the value, and a `NULL` band does not break `rowToScan`.
- **Trend consumption** — the trend engine treats a `'poor'` or `NULL` band as *not comparable* and
  excludes it from within-user deltas, rather than silently averaging a bad scan into the baseline.

This is the only backend surface the track touches.

## 6. The measurement instrument

### 6a. Synthetic renderer (`eval/render/face.ts`)

Pure and seeded-deterministic. Parameters: Fitzpatrick level; illuminant (colour temperature,
intensity); directional shading (azimuth, elevation, ambient); geometry (scale, translation, small
yaw); seven defect intensities (spots, redness, oiliness, pores, lines, dark circles, roughness);
sensor noise.

Forward rendering path:

1. skin reflectance from a melanin/haemoglobin model;
2. defect layers applied **in reflectance space** — multi-octave noise for pores and roughness,
   oriented ridges for lines, local reflectance drops for spots and dark circles;
3. Lambertian shading against an ellipsoid normal field;
4. a Blinn-Phong specular lobe in the T-zone scaled by oiliness;
5. multiplication by a Planckian illuminant;
6. exposure, sensor noise, sRGB encode, 8-bit quantization.

Rendering specular as **illuminant-coloured rather than skin-coloured** is what makes the 4a oiliness
fix testable — it is precisely why an absolute luma threshold is the wrong detector.

> **Circularity caveat.** If the renderer used the same skin model the illuminant estimator assumes,
> the tests would only prove the estimator can invert our own forward model. The renderer is
> therefore built on a different formulation than the estimator's linear log-chromaticity
> approximation, and one axis deliberately perturbs the model parameters.
>
> **Even so: this harness catches regressions and gross errors. It cannot certify real-world
> accuracy, and nothing in it licenses an accuracy or skin-tone-equity claim (CLAUDE.md §1). It is an
> engineering instrument, not validation data on file.**

### 6b. Four fail-closed axes (`eval/invariance/`)

| Axis | Sweep | Passes when |
|---|---|---|
| **Illuminant invariance** | 2700–7500 K × intensity {0.6, 1.0, 1.4} | per-dimension score spread ≤ ε |
| **Geometric invariance** | scale, translation, small yaw | spread ≤ ε — validates that scoring is robust to where the face sits, given a correct bbox |
| **Monotonic response** | each defect swept 0→1 in N steps | target score monotonically non-decreasing (Spearman ρ ≥ 0.9) **and** non-target scores within a cross-talk bound |
| **Tone preservation** *(negative)* | FST I→VI, fixed light and defects | tone-derived quantities still **differ** |

Tone preservation and the existing bias axis are complementary halves: the bias axis asserts that
*defect scores must not vary with tone*; the preservation axis asserts that *tone itself must not be
normalized away*. Without the second, 4b could achieve perfect invariance by destroying signal.

Monotonic response is the closest available proxy for accuracy without ground truth: it demonstrates
that a dimension actually responds to the thing it is named after, which today is asserted only by
the variable name.

**What these axes do *not* cover:** the renderer has no preview space, so the geometric axis
exercises `deriveRegions` and scoring under a varying face position, driven by synthetic contours —
it cannot exercise the real MLKit detector or its EXIF handling. Those have their own defence: the
device overlay (§3a). It does not substitute for the axis, and the axis does not substitute for it.

### 6c. Thresholds

Per-dimension ε bounds, the cross-talk bound, and the Spearman floor cannot be chosen a priori — they
are established empirically when the renderer first runs (sequencing step 2) by measuring the current
engine's spread, then set tight enough to fail on a real regression. They live in a dedicated
`eval/invariance/thresholds.ts`, mirroring the existing `eval/fairness/thresholds.ts` pattern, so
tuning never edits an axis. Initial values are recorded in the first committed report as the baseline
every later change is compared against.

Each axis writes an aggregate number to `eval/reports/` — aggregates only, never images or
per-subject data, matching the existing `eval/data/README.md` policy — so every change in this track
lands with a documented before/after.

## 7. Error handling

Every new stage **fails open to today's behaviour**. The read can get better; it can never get worse,
and it never crashes on a device quirk.

| Stage | Sanity check | Fallback |
|---|---|---|
| still detection | at least one face; bounds within image; aspect ∈ [0.6, 1.6]; area fraction ∈ [0.05, 0.95] | `approximateFaceBbox` |
| contour regions | every region inside the `FACE` polygon; non-overlap preserved | proportional regions off detected bounds |
| illuminant estimate | implied CCT ∈ [2000, 10000] K; bounded adaptation matrix | identity adaptation |
| shading fit | residual within bound | skip flattening |
| EXIF orientation | readable | assume 0 (the gate's centeredness check limits damage) |
| capture context | present and complete | current path (centered bbox, no normalization) |

The single exception is the hardened quality gate, which fails **closed** — see §5.

`withImageCleanup` guarantees are untouched: the image is deleted on success and on failure alike.

## 8. Testing

TDD throughout, per the project mandate — a failing test first on every pure module, ≥80% coverage
maintained.

- **`face-geometry`** is pure and tested against synthetic contour inputs — narrow, wide, off-centre,
  and partially-occluded faces — asserting the two §3b properties (containment in the `FACE` polygon,
  preserved non-overlap) and the fallback chain at each step. `detect-faces-still.ts` is the thin
  device shell around it and carries `// DEVICE-ONLY`.
- **`illuminant`** is tested against renderer output at known illuminants — recovery error bounded —
  plus the tone-preservation property as a direct unit test.
- **The three re-based dimensions** get before/after tests demonstrating exposure-invariance that the
  current implementations fail.
- **Device-only paths** carry `// DEVICE-ONLY` and are verified by eye on the Fold 7 via the overlay
  screen, then on iPhone once the org account lands.
- **The migration** extends the existing pgTAP suite per §5a — column constraint, RPC round-trip, and
  `NULL`-band tolerance in `rowToScan`.
- `npm run check:compliance` and `scripts/check-no-image-egress.mjs` stay green; the new eval axes are
  added to `package.json` scripts alongside the existing fairness run.

## 9. Sequencing

1. ✅ **Enable the real signals** (F1) — `FRAME_PROCESSORS_INSTALLED` flipped, stale comments
   corrected, static guard test added (commit `8940828`). Re-tuning `THRESHOLDS` and
   `SHARPNESS_SCALE` on the Fold 7 remains open, pending the dev build. *(device)*
2. **Renderer + the four axes** (§6) — build the instrument before changing what it measures, so
   every subsequent step has a documented delta.
3. **Relative dimensions** (4a) — the biggest win, pure, immediately measurable on the new axes.
4. **Area-averaged resample + EXIF orientation** (F4, F5) — pure, measurable on the same axes.
5. **Still detection + contour regions + overlay** (F2, §3a, §3b) — device shell plus pure geometry;
   the overlay is how EXIF agreement gets verified.
6. **Illuminant normalization + shading flattening** (4b, 4c).
7. **Gate hardening + quality band** (§5, §5a — includes migration `0013` and the RPC change).
   *(device tuning)*

Steps 2–4 and 6 are pure and need no device. Steps 5 and 7 need the dev build; step 1's tuning does
too, but only the tuning — the code change is already landed.

Steps 3, 4, and 6 each change scores, so each must be landed with its axis report committed — that
is what makes "this improved the read" a measured statement rather than an assertion.

## 10. Non-goals

- **No accuracy, efficacy, or skin-tone-equity claim** arises from this work. Synthetic invariance is
  not validation data on file (CLAUDE.md §1, §7).
- **No new cosmetic dimensions** — the wider vocabulary is the follow-on sub-project.
- **No new face-data vendor and no new dependency.** The still-image detector approved in §3a is an
  unused API of `react-native-vision-camera-face-detector`, already installed and already processing
  face data on-device. `package.json` does not change.
- **No trained model and no dataset** — the trained-model track stays gated on the founder/legal
  dataset decision (`docs/compliance/dataset-requirements-brief.md`).
- **No change to the compliance boundary** beyond persisting a coarse capture-quality band.

## 11. Risks

- **Device-specific tuning does not transfer.** `SHARPNESS_SCALE` and the new chroma thresholds can
  only be set empirically on hardware, and Fold 7 values will not carry to iPhone. Expect a second
  tuning pass when iOS comes online.
- **Frame-processor plane layout varies by device** (already flagged at `use-frame-metrics.ts:15`).
  The chroma grid inherits this risk; the existing per-frame try/catch degradation pattern applies.
- **The renderer is a model, not reality.** See the circularity caveat in §6a. Passing all four axes
  means the pipeline is self-consistent and physically sensible — nothing more.
- **EXIF disagreement is silent when wrong** (§3a). MLKit resolves orientation from the image URI;
  `jpeg-js` does not. If the two disagree, every region lands wrong with no error raised. This is now
  the highest-risk item in the design and the first thing to check on the overlay.
- **Contour availability is not guaranteed.** `runContours` yields contours "for only the most
  prominent face", and MLKit may return none on a poorly-lit or steeply-angled capture. The §3b
  fallback chain is therefore load-bearing, not defensive boilerplate — and the proportional path it
  falls back to must stay tested, not bit-rot.
- **MLKit has no arm64 iOS-simulator slice.** This is what forced the uncommitted `dev-stubs/` +
  `react-native.config.js` workaround. The still detector inherits it: capture and read work on
  physical devices and on Android, never in the iOS Simulator. The stub must keep the *still*
  detector inert too, or simulator runs will crash rather than degrade.

---

*Engineering design. Compliance posture per CLAUDE.md; nothing here changes what crosses the
compliance boundary or what may be claimed publicly.*
