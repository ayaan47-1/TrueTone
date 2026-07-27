# Handoff — TrueTone scan accuracy (`feat/scan-accuracy`)

**Written 2026-07-26 after a long physical-device session. Read this before touching the scan path.**

You are picking up a branch that has just been through four chained bugs, all of which were invisible
to a 717-test suite and only fell out on hardware. The most valuable thing in this document is not
the list of fixes — it is the **method** in §7 and the **traps** in §6. If you skip to the code you
will repeat the mistakes that cost this session six device round-trips.

---

## 1. What the product is, and the one line you cannot cross

TrueTone gives a skin-tone-fair read of skin **appearance** and a brand-neutral routine. It is a
**cosmetic / general-wellness product — NOT a medical device. It never diagnoses anything.**

`CLAUDE.md` at the repo root is the authority. Its hard rules, restated because they constrain
almost every change in this area:

- **The raw face image lives and dies on the phone.** Analyze locally, delete immediately. It must
  never be uploaded, logged, cached server-side, or sent to any third party. Only *derived cosmetic
  scores* cross to the backend.
- **No disease names, diagnoses, or treat/cure/prevent claims** in any user-facing output, ever.
- **No accuracy / efficacy / skin-tone-equity claim** ships without backing validation data on file.
  This branch does not yet produce such data — see §5.4.
- **No analytics/ad SDK anywhere near the scan path.** Enforced by `npm run check:compliance`.
- **18+ age gate; US-only for v0; no DNA/genetic data.**
- **Escalate rather than improvise** before adding any SDK/vendor/API that can reach face, skin,
  score, or health data.

Two scripts enforce parts of this and both must stay green:

```bash
npm run check:compliance   # no analytics/ad SDKs in deps or Expo config
npm run check:no-egress    # no image egress from src/features/capture, src/features/read, app/(dev)
```

`check:no-egress` greps for egress-ish tokens inside guarded directories. It has twice fired on the
word "upload" appearing in a *comment*. **Reword the comment; never weaken the guard.**

---

## 2. Current state

| | |
|---|---|
| Branch | `feat/scan-accuracy`, 81 commits ahead of `main` |
| HEAD | `b843c1e` |
| Tests | 717 passing / 133 suites |
| `tsc --noEmit` | clean |
| Compliance guards | both passing |
| Stack | Expo SDK 56, RN, TypeScript, Expo Router, `react-native-vision-camera@5.0.11`, `react-native-vision-camera-face-detector@2.0.1` (**patched**, see §4.3) |

Deliberately **uncommitted**, and must stay that way: `react-native.config.js` and `dev-stubs/`.
They null iOS autolinking of the MLKit face detector so the app builds for the Apple-Silicon iOS
Simulator. **They would break real iPhone builds.** Before any physical-device run, confirm
`metro.config.js` does **not** alias `dev-stubs/vision-camera-face-detector.js` — while it does, the
capture gate never sees a face and the still detector never returns one, which is indistinguishable
from a hardware failure.

### The pipeline, and the boundary that must hold

```
ON DEVICE   capture → quality gate → decode → face detect → regions → scores
                                   (raw image deleted here)
────────────── compliance boundary: only derived scores cross ──────────────
BACKEND     Supabase (auth, consent log, scores, retention) + LLM routine/chat (scores only)
```

---

## 3. Reproducing the dev loop

### Host

```bash
npm install          # postinstall runs patch-package — see §4.3
npx tsc --noEmit
npx jest             # ~6 min; the invariance suite dominates
npm run eval:invariance
```

### Device (this branch has only been run on an Android Fold 7)

The iOS Simulator has no camera; **anything camera-related needs a physical device.**

```bash
npx expo start --dev-client
```

Then on the phone, either connect via the dev-launcher's "Recently opened" entry (your Mac's LAN IP,
port 8081), or over USB with `adb reverse tcp:8081 tcp:8081`.

**The debug overlay** — `app/(dev)/bbox-overlay.tsx`, the instrument this whole session ran on — is
reachable two ways:

1. **You tab → `DEV · Region overlay`** (preferred; no adb needed)
2. `adb shell am start -a android.intent.action.VIEW -d "truetone:///bbox-overlay" com.ayaan47.truetone`
   — **three slashes.** With two, `bbox-overlay` parses as the URL *host*, Expo Router sees an empty
   path, and you land on the Today tab. This cost a round trip.

Do **not** force-stop first: on a cold start the app hasn't connected to Metro yet and the deep link
has nowhere to go.

The overlay mounts its own `<Capture>` (the read engine deletes the still, so there is no existing
image to draw on) and has a **magenta manual shutter** that bypasses the quality gate entirely —
`devForceCapture`, opt-in and double-fenced behind `__DEV__`. It exists so that verifying geometry
never creates pressure to loosen `THRESHOLDS`, which is production calibration.

### Environment gotchas that ate real time

- `EXPO_PUBLIC_*` is inlined at **bundle** time. Changing `.env` requires a **Metro restart**, not a
  reload.
- `.env`'s Supabase URL must be reachable **from the phone**. `127.0.0.1` only works with
  `adb reverse tcp:54321 tcp:54321`; without USB it must be your Mac's LAN IP, which churns on DHCP.
- A failed Supabase fetch blocks the **entire app** at the root layout's "Can't connect" gate. It
  presents as "the app is showing an old build".
- Local Supabase currently binds `*:54321` with demo credentials on a publicly-routable address.
  Pre-existing; worth closing.

---

## 4. What was just fixed, and how each was proven

Read these in order. **The order is the finding** — each bug was unreachable until the one in front
of it was fixed, and every one produced plausible, non-erroring, completely meaningless output.

### 4.1 The still arrived 90° rotated (`773314a`)

`capturePhotoToFile` wrote the raw sensor buffer: 3648×2736 **landscape**, EXIF tag **1**, for a
portrait selfie. `PhotoFile` exposes only `filePath`, so orientation was discarded at the capture
boundary and nothing downstream could reconstruct it. jpeg-js decoded a sideways face, MLKit found
nothing, `deriveRegionsForFace` fell back to a proportional guess, and the read scored hair and
background. Repeated scans "giving different results" was this — the fallback rect sampling different
backgrounds, not sensitivity.

Fixed by moving the guarantee upstream of the file: `capturePhoto()` (in-memory) → `toImageAsync()`
→ `Image.saveToTemporaryFileAsync('jpg', 100)`. The file now holds **upright pixels**, so jpeg-js and
MLKit agree by construction rather than by both honouring the same metadata convention.

**The read pipeline needed no changes** — `decode-rgb.ts`, `cv-read-engine.ts`, `run-read.ts` are
untouched, because the contract they already assumed is finally met. `exif-orientation.ts` is now a
no-op on our own captures and **tag 1 is the expected reading**, not a symptom.

Quality is pinned at **100** deliberately: rotating means re-encoding, and `microContrast` plus the
Immerkaer noise estimate read exactly the high-frequency energy JPEG quantisation removes. A cheaper
setting biases the read rather than merely shrinking a temp file. `containerFormat` is pinned to
`'jpeg'` (was `'native'`) because `capturePhoto` is documented reliable for JPEG only on Android and
`'native'` means HEIC on iOS.

### 4.2 The conversion loses a half turn on a mirrored frame (`e460d7c`)

**This one matters most as a cautionary tale.** The check shipped with 4.1 asked *"did the axes
swap?"* and printed a confident green pass **on an upside-down image** — because a quarter turn *the
wrong way* swaps them identically.

```
mirror ∘ rotate(θ)  ≡  rotate(−θ) ∘ mirror       ⇒  error = 2θ
```

2θ = **180°** for a quarter turn, **0** for `up`/`down`. The frame was `orientation "right",
mirrored yes`. Both candidate rotations yield identical portrait dimensions, so **only pixels can
distinguish them** — no size-based check could ever have caught it.

`conversionResidualDegrees` is bounded to exactly what was measured: mirrored **and** quarter-turn
**and** the conversion did the rotating. When our own `rotateAsync` rotated, no ordering was involved
and correcting again would *introduce* the error — a test pins that. 180° has no direction ambiguity,
so it cannot be applied backwards.

**iOS is unverified.** This pass was Android and the project is iOS-primary.

### 4.3 `createImageFaceDetector` is broken upstream, on both platforms (`f49cccd`)

With the still finally upright and well framed, the detector still returned nothing:

```
detectFaces() threw: java.lang.IllegalArgumentException:
Invalid image type. Expected string or { uri }
  at HybridImageFaceDetector.resolveInputImage(HybridImageFaceDetector.kt:33)
```

`resolveInputImage` takes `Any?` and tests `is String` / `is Map<*, *>` — the shape the **old RN
bridge** delivered. Nitro delivers neither: `InputImage` is a generated **sealed class**
(`First(String)` / `Second(Double)` / `Third(ImageUri)`), so every call fell to `else` and threw
whatever JS passed. Passing a bare string arrives as `InputImage.First` and fails identically; there
was **no JS-side fix**. iOS has the same defect (`as? String` against a Swift **enum**).

**Version 2.0.6, the latest, carries identical code on both platforms.** `createImageFaceDetector`
has never worked in this package.

Fixed in `patches/react-native-vision-camera-face-detector+2.0.1.patch` via `patch-package` +
`postinstall`, verified by deleting the package and reinstalling. This is a **bug fix to a dependency
already in use and already processing face data on-device** — not a new vendor, no change to what
data is touched or where it goes.

**It requires a native rebuild** (`eas build --profile development --platform android`). The Swift
half is a direct translation of the verified Kotlin fix and has **not been exercised on hardware**.
Worth filing upstream — `npx patch-package react-native-vision-camera-face-detector --create-issue`
drafts it.

### 4.4 MLKit's contours are not all polygons (`9ca6d21`)

The patched detector returned a face and all 15 contours, and derivation still rejected them with
`missing-contour:LEFT_CHEEK` — while listing `LEFT_CHEEK` as present. The check was `length < 3`.
Real counts, read off the device:

```
FACE:36  LEFT_EYE:16  RIGHT_EYE:16  *_EYEBROW_*:5  *_LIP_*:9-11  NOSE_BOTTOM:3
NOSE_BRIDGE:2        ← a line: bbox width ≈ 0
LEFT_CHEEK:1  RIGHT_CHEEK:1   ← single points: zero-area bbox
```

Three of nine required contours are not polygons. Past the point check the geometry was still
unbuildable: cheeks were `inset(box(cheek), 0.15)` and tZone's width `bridge.w * 2.2`. **`source:
'contours'` could never have succeeded on real hardware.**

Fixed with per-contour minimum point counts, cheek patches built around the contour **centroid** and
sized from the face box, and tZone keeping the bridge's midline for its x but taking its **width from
`NOSE_BOTTOM`**. The centroid equals the point itself for a 1-point contour and stays correct for the
multi-point synthetic fixture, so one code path serves both.

**Confirmed on device: `source: contours`.**

---

## 5. Open work, in priority order

### 5.1 Region placement quality — start here

`source: contours` means derivation *succeeded*, not that the boxes are anatomically **right**. First
visual read suggests they sit high and tight — the forehead patch near the brow line rather than
mid-forehead, cheek patches medial of the cheek apples.

Capture in the overlay, read the printed `regions (working space)` rects against the printed
`scaled bounds`, and tune the fractions in `src/features/read/face-geometry.ts`. The new constants —
`CHEEK_WIDTH_FRACTION_OF_FACE`, `CHEEK_HEIGHT_FRACTION_OF_FACE`, `TZONE_WIDTH_FROM_NOSE_BASE` — were
chosen on anatomical reasoning, **not measured**. They are the obvious first thing to calibrate.

### 5.2 Mirroring — needs a human, not code

`photo.isMirrored` is reported, but the **pixels cannot confirm it**: a mirrored face is still a
plausible face. Settle it by eye — touch your left cheek; the box labelled "L" must be on that cheek.
A pure L/R swap does not change the baseline (both cheeks are averaged) but it swaps every per-side
region.

### 5.3 `THRESHOLDS` calibration — never done on hardware

`src/features/capture/quality-gate.ts` thresholds were set from synthetic renders. An ordinarily-lit
room measured **0.31–0.34 brightness against a 0.35 floor**, i.e. the gate is probably mis-calibrated
rather than the room being bad. Same for `SHARPNESS_SCALE` in `luma-metrics.ts` and the newer
`clippingMax` / `cctMin` / `cctMax` / `imbalanceMax` / `poseMax`. All JS — hot-reloads, no rebuild.

Tune against **real** captures. The overlay's manual shutter exists precisely so this is measured
rather than assumed.

### 5.4 The structural gap — the fairness harness does not test what ships

**Read this before trusting any fairness number.**

`eval/invariance/axes.ts:16` scores via `scoreFromBbox(rgb, bbox)` — the **proportional** path. It
never calls `regionsFromContours`. So every fairness number, threshold, and PASS/FAIL verdict on
record describes the **bbox** derivation, while production prefers **contours**. The contour path has
**zero fairness coverage**.

This is why the invariance report came back byte-identical after cheek and tZone geometry changed:
the harness does not run that code.

Compounding it, `eval/render/geometry.ts:55,61` builds cheeks as 12-point ellipses and the bridge as
an 8-point one — shapes MLKit does not produce. The fixture asserts a reality that does not exist.

Closing this means touching `eval/render/` and **would move the baselines**. It is an open decision
for the founders, not a quiet fix. See §6.

### 5.5 Known-failing fairness axes (intended, do not "fix" by loosening)

`defect-tone-fairness` sweeps defect levels {0, 0.1, 0.25, 0.5, 0.75, 1.0} and gates on the **worst**
level. **Seven of eight dimensions fail**; only `fineLines` passes. `Overall: FAIL` is **INTENDED**
and must not be made green by relaxing thresholds.

Two distinct failure shapes:

- **Worst at HIGH defect** (oiliness, redness, pores, darkCircles) — tone-dependent *sensitivity*, a
  **gain** error. Fix by dividing by per-subject dynamic range.
- **Worst at LOW defect** (texture, hydration, darkSpots) — tone-dependent *floor*, an **offset**
  error. `darkSpots` is a **harness artifact**, not a real defect: the forehead rect pokes onto the
  renderer's 0.18 grey backdrop, which reads as "dark" only when `skinY > 0.189` — crossing over
  exactly between FST V and VI. Production uses contour-derived regions, so it cannot happen there.

`oiliness` on FST I–III is **categorically a saturation detector**, proved analytically: firing needs
`S ≥ 1.857·D` but available specular radiance caps at `1−D` — FST I needs 1.331 against 0.283
available. `w_clean = 0.0000` at I/II/III confirms it empirically. This is recorded at the point of
use in `src/features/recommend/skincare/rules.ts`, because `oil_control` gates on it and, via an
if/else, a false positive also **suppresses** `hydrating_serum`.

### 5.6 Attempts already made and reverted — do not retry blind

| Attempt | Result |
|---|---|
| Exclude any-channel-clipped pixels from oiliness | Killed the monotonic axis (rho 0.9535 → 0) |
| Exclude only fully-white pixels | Max shine unreadable on FST I–IV; max-defect spread 0.20 → 0.291 |
| Subtract an Immerkaer noise floor from `microContrast` | Texture spread 0.0006 **but the dimension died** (0.0000 at defect 1, rho 0) |

The last one has a known cause: `eval/render/face.ts:113` synthesizes roughness as **fully
decorrelated per-pixel noise**, spectrally identical to sensor noise. Giving roughness a physical
correlation scale is the open renderer decision; the trap is that decorrelated noise was chosen to
avoid roughness→darkSpots crosstalk measured at **0.36–0.52 against a 0.07 ceiling**.

---

## 6. Standing rules — the things that will bite you

1. **Never loosen a threshold or bound to make an axis pass.** Do not parameter-sweep until green.
   If a predicted direction and the measured result disagree, **stop and report** rather than
   adjusting until it is green. New constants only by principled substitution.
2. **Do not modify `eval/render/` without founder sign-off.** It defines the measuring instrument;
   changing it invalidates every recorded baseline.
3. **A pass is a claim about a CONDITION, not a dimension.** `darkSpots` was recorded as passing for
   several tasks purely because the sweep sampled a single defect level. Verdicts still
   condition-bound and unchecked: `monotonic`, `illuminant`, `geometric` sweep at FST III only;
   `tone-preservation` uses one fixed defect blend.
4. **`Overall: FAIL` is intended.** Do not "fix" the report.
5. **Do not interpret device scan numbers** until §5.1 and §5.2 are settled.
6. **Never add a third camera output.** CameraX guarantees Preview + ImageCapture + **one**
   ImageAnalysis; a second threw "No supported surface combination" on the Fold 7. Face detection
   runs inside the luma worklet for this reason — see `use-frame-metrics.ts`.
7. **`Face` objects are Nitro HybridObjects.** They do not survive the worklet→JS boundary; copy to
   plain objects. Their properties live on a prototype, so `Object.keys` returns nothing — an empty
   key list is a *signature*, not an absence.

---

## 7. Method notes — the part that actually earned its place

**Every claim of the form "this doesn't need checking" that survived review was later falsified by
hardware.** Four times in this branch:

- the frame-consistency guard's supposed EXIF coverage
- the `react-native-vision-camera-worklets` package ("stale v3/v4 lore" — it was genuinely required,
  and the trap was that `react-native-worklets` *without* the prefix **is** installed and its
  `libworklets.so` loads, which made the wrong claim look verified)
- the orientation dimension check, which printed **confident green on an upside-down image**
- the contour fixture, which asserted shapes MLKit does not produce

Treat "nothing is missing here" as an **untested hypothesis**.

**Collapsed error paths cost a device round-trip each.** `detectFacesOnStill` folded four unrelated
failures into one `null`; `source: bounds` folded six rejections into one word. Both now name their
actual cause — `src/features/read/still-detection-diagnostics.ts` (13 host tests) and
`contourRejectionReason` in `face-geometry.ts`. **Instrument before guessing.** It paid for itself
three times in one session, and each instrument is host-testable, so the cost is small.

**When you build a check, ask what it would say if the thing were wrong in a way you didn't imagine.**
The orientation check verified a *proxy* (did the aspect ratio swap) rather than the *thing* (is the
face upright), and confidently passed a 180°-wrong image. The diagnostic that replaced it prints
`UNDETERMINED` rather than a pass when the sizes carry no evidence — a `null` is not a pass.

---

## 8. File map for this area

| Path | Role |
|---|---|
| `src/features/capture/Capture.tsx` | Guided capture, gate, auto-capture, `devForceCapture` |
| `src/features/capture/capture-upright.ts` | Photo → upright still on disk. Host-tested via structural interfaces |
| `src/features/capture/photo-orientation.ts` | Pure rotation arithmetic + the applied/not/undetermined decision |
| `src/features/capture/use-frame-metrics.ts` | Luma worklet + face detection (one ImageAnalysis) |
| `src/features/capture/quality-gate.ts` | `THRESHOLDS` — **needs hardware calibration** |
| `src/features/read/decode-rgb.ts` | JPEG → RGB at 512px working size |
| `src/features/read/exif-orientation.ts` | Now a no-op on our captures; safety net for other sources |
| `src/features/read/detect-faces-still.ts` | MLKit still detection + `detectFacesOnStillDetailed` |
| `src/features/read/still-detection-diagnostics.ts` | Names *which* detector failure occurred |
| `src/features/read/face-geometry.ts` | Contours → regions, `contourRejectionReason`, the new constants |
| `src/features/read/cv/score-from-rgb.ts` | The scoring core |
| `app/(dev)/bbox-overlay.tsx` | **The instrument.** Mirrors the engine's transform chain step for step |
| `eval/invariance/axes.ts` | Fairness axes — **scores via bbox, not contours** (§5.4) |
| `eval/render/` | The synthetic renderer — **sign-off required** |
| `patches/` | The upstream detector fix |
| `docs/superpowers/plans/2026-07-25-scan-accuracy-pipeline.md` | Full task history; Tasks 15b–15e are this session |
| `docs/superpowers/specs/2026-07-25-scan-accuracy-pipeline-design.md` | Design spec |

The overlay **mirrors `CvReadEngine.run`'s transform chain deliberately** rather than re-deriving it.
If it ever diverges it becomes reassuring and wrong, which is worse than not existing. Keep them in
step.

---

## 9. Suggested first move

1. `npx expo start --dev-client`, open the overlay from the **You** tab, tap the magenta shutter.
2. Confirm it still reads `source: contours` and `detector outcome [ok]`.
3. Screenshot / read the `regions (working space)` block and compare each rect against
   `scaled bounds`. That is §5.1, and it is the last thing between this branch and a scan number
   that means something.

Do **not** start on fairness (§5.4/§5.5) before §5.1 is settled — tuning invariance on regions that
sit in the wrong place would calibrate the wrong instrument, which is the mistake this entire
document is a record of.
