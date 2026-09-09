# Capture Reliability Plan — controlling the skin-capture for cross-shade fairness

**Status:** brightness-floor fix landed in this branch (`fix/capture-brightness-floor`); camera-lock
and screen-flash are specified here for a device-tested build. **Author:** orchestrator (god), from
two capture audits. **Reviewers needed:** Toby (code), Dwight (compliance).

## Problem (from the capture audit)

The shade engine measures `skin × light × sensor`, not skin. Today the front capture is **fully
uncontrolled**:
- **No white-balance / exposure / ISO lock** — `Capture.tsx` `usePhotoOutput` sets only
  `jpeg`/`balanced`; `capturePhoto({}, {})` has no options; the `<Camera>` sets no control props.
- **Ambient light only** — no torch/flash/screen-flash (the white `Animated` overlay is UI feedback,
  not a light source). UI even says "Natural light works best".
- **No color-constancy correction** — skin Lab is taken from raw pixels. An illuminant estimator
  (`cv/illuminant.ts`) exists but is deliberately **unwired**: the team correctly found the
  melanin/Planckian directions ~93% collinear (chroma can't separate dark skin from warm light) and
  that the dominant error axis is **exposure/intensity**, which chroma can't fix. Gray-world/
  white-patch are prohibited (they desaturate/lighten deep skin).

**Deep-tone hazards:** auto-exposure over-brightens dark faces (uncompensated); auto-WB shifts the
read with room color temperature; and the old `brightnessMin: 0.35` gate wrongly rejected valid
deep-skin captures (real range 0.18–0.34, handoff §5.3).

**Conclusion: you cannot reliably _correct_ a bad capture here — you must _control_ it.** Impose a
known light + fixed camera settings instead of recovering an unknown illuminant.

## Change 1 — brightness floor (DONE in this branch)

`quality-gate.ts` `brightnessMin` 0.35 → **0.18** (+ a regression test that a 0.25 deep-tone capture
passes lighting). Provisional; must be re-validated on a real multi-lighting/multi-device set.

## Change 2 — lock white balance / exposure / ISO (build + device test)

**Feasible via vision-camera's controller API (v5) — no native patch needed.** The library exposes,
guarded by device support flags:
- `device.supportsExposureLocking` → `controller.lockCurrentExposure()` **or**
  `controller.setExposureLocked(exposureDuration, iso)` (e.g. `1/60`, iso `200`).
- `device.supportsWhiteBalanceLocking` → `controller.lockCurrentWhiteBalance()` **or**
  `controller.setWhiteBalanceLocked(temperature, tint)` (rec. 2500–8000K, tint −150..150).
- `controller.resetFocus()` returns exposure/WB/focus to auto.

**Implementation:** obtain the camera controller ref; when the quality gate is about to fire the
capture, if the front device reports the `supports*Locking` flags, lock exposure+WB (start with
`lockCurrent*` to freeze the metered values at a good frame, then optionally pin explicit
`setExposureLocked`/`setWhiteBalanceLocked` values once calibrated). Reset on unmount / retry.
**Open on-device questions (must verify on hardware):** (a) does the pinned `5.0.11` expose these
controller methods; (b) does the **front** camera report `supports*Locking` on target devices;
(c) correct timing vs the existing capture state machine. Guard everything on the support flags and
fall back to current auto behavior if unsupported.

## Change 3 — screen-flash as a known illuminant (build + device test)

Light the face with the phone's **screen** in a dim environment so a known source dominates ambient
— the physical fix for the exposure/intensity + illuminant ambiguity the chroma math couldn't solve.
**Approach:** at capture, raise screen brightness to max (via `expo-brightness` `setBrightnessAsync`,
restore after) and render a full-white layer (repurpose/extend the existing white overlay) for the
capture frames; time it with `capturePhoto`. Gate on ambient being dim enough (reuse the existing
brightness/CCT frame metrics) and prompt the user to dim the room if it's too bright for the screen
to dominate. **Open questions:** screen-flash intensity/uniformity across devices; front-camera
exposure interaction with the sudden brightness; timing so the lit frame is the captured one.
**Requires a dev build on a physical device** — cannot be validated in simulator or host tests.

## Calibration dependency (internal data, NOT a user corpus)

The locked exposure/ISO values, the screen-flash intensity, and the brightness floor must be
calibrated against **real multi-lighting / multi-device captures** — but this can be the founders'
own faces or a color-reference target under varied lighting: **internal test data, not a consented
user BIPA corpus.** Only a Fold 7 has been tested; iOS is unverified. This is the gating resource for
finishing Changes 2–3.

## Compliance (Dwight)

- Changes only affect **how the face is lit and how the camera is configured** — NOT **what** is
  captured or retained. The **on-device raw-image-delete invariant is untouched** (`withImageCleanup`
  still owns and deletes the photo). No new data crosses the compliance boundary; no new SDK touches
  face data (`expo-brightness` only reads/sets screen brightness).
- Camera build stays **direct-install / never TestFlight** (two named principals).
- Gate copy stays light/framing-only (CLAUDE.md §1) — any new screen-flash prompt ("dim the room")
  describes lighting, not skin.

## Sequencing & testing

1. Brightness floor — **done**, host-unit-tested.
2. Camera lock — build behind device-support guards; **human on-device test** under varied lighting.
3. Screen-flash — build; **human on-device test**; calibrate intensity on internal captures.
4. Only after capture is controlled: return to the shade-accuracy eval + Lab→shade calibration
   (`tt-shade-calibrate-eval`) — calibrating against a now-trustworthy Lab.

Pure logic (gate thresholds, any brightness/timing helpers) is host-unit-tested (TDD). The camera
controller + screen-flash integration is inherently device-validated by the human.
