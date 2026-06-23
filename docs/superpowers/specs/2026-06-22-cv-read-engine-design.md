# Real On-Device CV Read Engine — Design Spec

**Date:** 2026-06-22
**Status:** Approved (brainstorm) — pending implementation plan
**Build-order context:** Makes build-order step 5 ("guided capture + on-device read → cosmetic scores") *real* by replacing the stub read with a classical-CV engine and verifying the full flow on a physical Android device.

---

## 1. Goal

Replace `stubRead` with a real **classical computer-vision** read engine behind the
existing `ReadEngine` interface, and complete the **Android on-device verification**,
so the full flow runs for real: capture → real CV read → real cosmetic scores →
routine → chat, on a physical Android phone.

This is the "real e2e" milestone, defined as **engineering-complete**: real scores on
device, fairness harness green on synthetic + an internal founders'-consented self-test
set, and **no public accuracy/equity claim** (that remains legally gated).

## 2. Decisions locked in brainstorming

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring approach (v1) | **Classical CV** | ML needs a consent-gated face dataset that cannot be collected yet (BIPA/18+/US-only). CV needs no dataset, runs on-device, is explainable, and is fairness-tunable by construction. |
| Implementation surface | **Pure TS over decoded RGB** | Every dimension extractor is host-testable; only JPEG→RGB decode is device-only. |
| Face regions | **Bounding-box-derived** sub-rectangles | No facial landmarks in v1; proportional offsets from the detector bbox. Landmarks deferred to v2. |
| Target platform | **Android only** | No external blocker. iOS is a later milestone gated on Apple Org enrollment. |
| Definition of done | **Engineering-complete** | Real scores on device + fairness green on synthetic/self-test. No public equity claim. |
| Future learned model | **Dormant `.pte` shell retained** | `executorch-engine.ts` stays in-tree so a learned `cv-2`/ML model drops behind the same `ReadEngine` interface later. |

## 3. Scope

**In scope (this spec):**
- Classical-CV read engine producing the existing 8-dimension `ScoreVector` + `SkinTypeFeel`.
- Android on-device verification: JPEG→RGB decode, real frame processors, physical-phone pass.
- Fairness harness wired to run the CV extractor (synthetic + internal self-test).

**Out of scope (separate specs / follow-ons):**
- **C. Trend re-scan loop** (build-order step 7) — independent feature.
- **D. Real consented fairness dataset + counsel sign-off** — legal gate; required before any
  public accuracy/equity claim, **not** before this milestone.
- **iOS** — separate milestone after Apple Developer Organization enrollment.

## 4. Architecture

The compliance boundary and the `ReadEngine` seam stay exactly where they are today.

```
ON DEVICE
  capture (vision-camera + quality gate)  →  photo file URI
        │  CvReadEngine.run(uri)  [implements existing ReadEngine interface]
        │    [DEVICE-ONLY: JPEG → RGB decode + face bbox detection on the still]
        ▼
  RgbImage { width, height, data: Uint8ClampedArray } + bbox: Rect   (fixed working size)
        │  scoreFromRgb(rgb, bbox)   [PURE TS — fully host-testable core]
        ▼
  ScoreVector (8 dims, 0..1) + SkinTypeFeel
        │   • deriveRegions(bbox): cheek baseline, infraorbital, forehead, periocular, T-zone
        │   • sampleBaseline(): robust skin baseline in CIELAB
        │   • 8 dimension extractors, each baseline-relative for fairness
        │   • classify() → skin type
        ▼
  ReadResult { scores, skinType, modelVersion: 'cv-1', isStub: false }
        │  (raw image deleted here — unchanged)
  ───── compliance boundary: only derived scores cross ─────
  recordScan(result)  →  Supabase  (unchanged)
```

**Key property:** the read splits into a thin **device wrapper** (`CvReadEngine.run(uri)`,
which keeps the existing `ReadEngine` interface unchanged) and a **pure core**
(`scoreFromRgb(rgb, bbox)`). Only the wrapper's JPEG→RGB decode and still-image face-bbox
detection are device-only; the entire scoring core is pure TypeScript over a decoded RGB
array. This makes all extractors unit-testable on synthetic fixtures and lets the fairness
harness run the core without a device.

## 5. Components

Each is a small unit with one responsibility. Pure units are host-tested; only the two
native units require a device.

### 5.1 Color & geometry utilities (pure)
- **`src/features/read/cv/color.ts`** — `srgbToLab(r,g,b) → { L, a, b }` plus small helpers.
  CIELAB is the basis for most dimensions: `L` (lightness), `a` (redness).
- **`src/features/read/cv/regions.ts`** — `deriveRegions(bbox, { width, height }) → Regions`.
  Proportional sub-rectangles from the face bbox:
  `Regions = { cheekL, cheekR, infraorbitalL, infraorbitalR, forehead, periocularL, periocularR, tZone }`,
  each a `Rect = { x, y, w, h }`. No landmarks.

### 5.2 Skin baseline (pure) — fairness keystone
- **`src/features/read/cv/baseline.ts`** — `sampleBaseline(rgb, regions) → SkinBaseline`
  where `SkinBaseline = { L: number, a: number, b: number }`. Robust median of L\*/a\*/b\*
  over the cheek patches with outlier trimming. Every dimension is scored **relative to this
  baseline**, which is what keeps the `bias.ts` FST-correlation near zero across skin tones.

### 5.3 Dimension extractors (pure)
`src/features/read/cv/dimensions/<name>.ts`, each exporting
`(rgb: RgbImage, regions: Regions, baseline: SkinBaseline) → number` clamped to `0..1`:

| Dimension | Signal |
|-----------|--------|
| `redness` | mean a\* in cheek/nose minus baseline a\* |
| `darkSpots` | area fraction of localized hyperpigmentation (pixels meaningfully darker than their *local* neighborhood) |
| `darkCircles` | infraorbital L\* deficit vs cheek-baseline L\* |
| `oiliness` | specular-highlight fraction in T-zone (bright, low-saturation pixels) |
| `texture` | normalized high-frequency (Laplacian) energy over cheek/forehead skin |
| `pores` | small-blob local-contrast density in the T-zone |
| `fineLines` | oriented gradient/edge response in periocular + forehead |
| `hydration` | proxy from fine-scale smoothness (inverse micro-texture) — **coarse v1 proxy** |

Each maps its raw metric → `0..1` via a calibration constant in one central file (§5.6).

### 5.4 Skin-type classifier (pure)
- **`src/features/read/cv/skin-type.ts`** — `classify(scores: ScoreVector) → SkinTypeFeel`
  from oiliness / hydration / redness (high oiliness → 'oily'; high redness → 'sensitive';
  divergent T-zone vs cheek → 'combination'; otherwise 'dry').

### 5.5 Orchestrator — pure core + device wrapper
- **`src/features/read/cv/score-from-rgb.ts`** (pure) — `scoreFromRgb(rgb: RgbImage, bbox: Rect)
  → ReadResult`: deriveRegions → sampleBaseline → run 8 extractors → classify →
  `ReadResult { scores, skinType, modelVersion: 'cv-1', isStub: false }`. Host-tested.
- **`src/features/read/cv/cv-read-engine.ts`** — `CvReadEngine implements ReadEngine` with the
  unchanged `run(uri: string): Promise<ReadResult>` signature. The wrapper calls
  `decodeJpegToRgb(uri)` and the device face detector to get `(rgb, bbox)`, then delegates to
  the pure `scoreFromRgb`. `run-stub-read.ts` (or its successor `run-read.ts`) swaps from
  `stubRead()` to this engine.

### 5.6 Calibration (pure)
- **`src/features/read/cv/calibration.ts`** — all per-dimension normalization constants and
  region proportions in one place. No magic numbers scattered across extractors; tuned against
  the fixtures and the fairness self-test (§7).

### 5.7 Native units (device-only) — sub-project B
- **`src/features/read/decode-rgb.ts`** — `decodeJpegToRgb(uri: string) → Promise<RgbImage>`.
  Replaces the throwing stub at `executorch-engine.ts:45`. Implemented with a vision-camera
  resize/decode plugin or `expo-image-manipulator`, producing a fixed working-size RGB buffer.
- **`src/features/read/detect-bbox.ts`** — `detectFaceBbox(uri | rgb) → Promise<Rect>` on the
  **still image** (native face detector, e.g. MLKit). The capture-time bbox came from a lower-res
  live preview frame, so the still is re-detected for accurate region placement. Device-only;
  host tests feed a known `bbox` straight into `scoreFromRgb`.
- **Frame processors** — flip `FRAME_PROCESSORS_INSTALLED = true` in
  `src/features/capture/use-frame-metrics.ts` and wire the real face-detector + luma worklets.
  The pure `facesToMetrics` / `computeLumaStats` already exist and are tested.

### 5.8 Fairness adapter
- **`eval/fairness/cv-extractor.ts`** — wraps `CvReadEngine` + a fixture loader into the
  harness's `Extractor` (`(entry) → { gate, scores }`), so fairness runs in CI on the internal
  self-test set with no device.

### 5.9 Shared types
- **`src/features/read/cv/types.ts`** — `RgbImage`, `Rect`, `Regions`, `SkinBaseline`.

## 6. Data flow (one scan)

1. `Capture` passes a photo file URI to `onCaptured` (unchanged).
2. `decodeJpegToRgb(uri) → RgbImage` at a fixed working size (**512px longest edge**: enough
   detail for texture/pores, small enough to stay fast in TS). *Device-only.*
3. `detectFaceBbox` runs the native detector on the **still** → `bbox` → `deriveRegions`.
4. `scoreFromRgb(rgb, bbox)`: `sampleBaseline` → 8 extractors → `classify` → `ReadResult`.
5. The existing cleanup wrapper deletes the image and calls `recordScan` (both unchanged).
   The image never crosses the compliance boundary.

## 7. Calibration & fairness loop (no real faces required for this milestone)

`calibration.ts` constants are tuned against two deterministic, in-repo synthetic sources:

- **Property fixtures** — procedurally generated `RgbImage`s with a *known* manipulation
  (a patch with elevated a\*, an injected dark blob, added high-frequency noise). Assertion:
  the targeted dimension rises while others stay flat. These are both the unit tests and the
  calibration anchors.
- **Fairness self-test** — the same fixtures rendered across six baseline skin tones (I–VI),
  fed through `cv-extractor.ts` into the existing harness. Tune constants until `bias.ts`
  correlation ≤ 0.2 and gate parity / stability pass on synthetic. This proves the fairness
  *method*; real consented faces (sub-project D) later prove the real-world *claim*.

## 8. Testing strategy (TDD)

- **Unit:** every util, region, baseline, extractor, classifier — pure, synthetic fixtures,
  RED → GREEN.
- **Integration:** `CvReadEngine.run` over a composed fixture → full `ReadResult`; cosmetic
  post-filter (`assertCosmetic`) still green.
- **Fairness:** harness smoke test runs the **CV extractor**, not only
  `buildSyntheticObservations`.
- **Device (manual, the B pass):** fresh Android dev build → real photo → real scores render →
  `check-no-image-egress` + `check-no-analytics-sdk` green. The one step a human runs on the phone.

## 9. Definition of done

- [ ] Real CV scores from a real captured photo, end-to-end on a physical Android phone.
- [ ] All host tests + fairness harness green on synthetic + the internal self-test set.
- [ ] `isStub: false`, `modelVersion: 'cv-1'`; `.pte` / executorch shell left dormant for v2.
- [ ] **No public accuracy / efficacy / skin-tone-equity claim** — gated on sub-project D.
- [ ] Existing compliance gates all still pass: image-egress, no-analytics, cosmetic
      post-filter, 18+ gate, logged consent, RLS, encryption.
- [ ] No new SDK/vendor with access to face/health data introduced.

## 10. Known limitations (v1, stated honestly — not blockers)

- `hydration` and `pores` are the weakest CV signals; marked in code as coarse v1 proxies.
  No precision is claimed for them beyond a directional read.
- Bounding-box regions are coarser than landmark-based regions; acceptable for v1, revisited
  with landmarks in v2.
- Real-world fairness is validated only on synthetic + internal self-test until sub-project D
  lands the consented I–VI dataset.

## 11. Compliance checklist (CLAUDE.md §7)

- [x] No raw image persisted server-side; image deleted after analysis (unchanged path).
- [x] No new SDK/vendor with access to face/health data.
- [x] Output passes the cosmetic-vocabulary post-filter (schema unchanged; descriptors unchanged).
- [x] Gated behind the 18+ gate and logged consent screen (unchanged).
- [x] Covered by delete-everything + retention/auto-deletion job (scores unchanged).
- [x] Encrypted in transit + at rest; RLS scoped to owning user (unchanged).
- [x] No accuracy/equity claim shipped without validation data on file (explicitly deferred to D).
