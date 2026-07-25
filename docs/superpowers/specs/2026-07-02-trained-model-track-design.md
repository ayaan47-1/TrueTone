# Trained On-Device Model Track — Design (dataset-gated)

**Date:** 2026-07-02
**Status:** Approved direction; **training is HARD-GATED on a consented/licensed dataset
(founder + legal decision — CLAUDE.md §6). No training, and no user data ever, without it.**
**Companion spec:** `2026-07-02-personalization-design.md` (engine-agnostic; unaffected by
this track's timing)

## 1. What this is

Replace the heuristic classical-CV read (`CvReadEngine`, `cv-1`) with a neural model that is:

- **trained offline, by us**, on a properly consented/licensed face dataset — never on
  users' images (which never leave the device and are deleted after each read, §1/§3);
- **shipped as fixed weights** (an ExecuTorch `.pte` asset) running fully on-device via
  `react-native-executorch` — the app runs a model that *was* learned; it does not learn
  from users;
- validated for tone-fairness on the existing held-out Fitzpatrick I–VI harness **before**
  it becomes the default engine.

## 2. Compliance invariants (unchanged, restated because this track is where they bite)

- The raw face image stays on-device and is deleted after the read (`withImageCleanup`);
  enforced statically by `scripts/check-no-image-egress.mjs`. The model runs inside that
  same lifecycle.
- **Users' images are never training data.** The prohibited version of "learning" —
  harvesting user selfies into a dataset — is a BIPA/§6 red line, full stop.
- The fairness eval set (`eval/fairness/`) is **held-out validation only**. It is
  consent-gated for eval and must never be trained on, or it can no longer certify
  tone-fairness.
- A model that is (or is claimed to be) more accurate = an **accuracy claim**: nothing
  ships a claim without validation data on file (§1), and the absolute-age flag stays dark
  regardless.

## 3. Pipeline (end-to-end)

```
[GATE: founders/legal deliver consented/licensed dataset]
   └→ offline training (Python/PyTorch, separate repo or /training dir — never in the app bundle)
        └→ export to ExecuTorch .pte  (output contract: [1, 12] float — 8 dimension scores + 4 skin-type logits,
                                       the existing MODEL_OUTPUT_LENGTH / decodeModelOutput contract)
             └→ replace src/features/read/assets/stub-model.pte; bump MODEL_VERSION 'stub-1' → 'nn-1'
                  └→ implement decodeToRgb (native JPEG decode+resize to 224×224; DEVICE-ONLY, physical iPhone)
                       └→ validate: fairness harness (Fitzpatrick I–VI, held-out) + calibration eval vs labels
                            └→ flip run-read default: CvReadEngine → ExecutorchEngine
                                 └→ cutover checklist (below)
```

## 4. What already exists (no work needed)

- `ExecutorchEngine` (`src/features/read/executorch-engine.ts`): complete device shell —
  loads a `.pte` once, forward pass, `[1, 12]` output decoded by the pure, tested
  `decodeModelOutput`; image deleted via `withImageCleanup` on success or failure.
- Pure, tested pre/post: `normalizeToTensor` (with length guard), `decodeModelOutput`,
  `image-lifecycle`.
- `ReadEngine` interface: `run-read.ts` swaps engines behind one line.
- Fairness harness wired to engines (`eval/fairness/`), with the fail-closed axis verdicts.

## 5. Buildable now (pre-dataset, all inert-safe)

1. **Dataset requirements brief for founders/legal** — the concrete ask: face images with
   explicit biometric-use consent or a commercial license covering model training; balanced
   Fitzpatrick I–VI representation; per-image cosmetic-dimension labels (or a labeling
   plan); adults 18+ only; US-lawful provenance; documentation retained on file. This brief
   is the deliverable that unblocks everything else.
2. **Training-repo scaffold** — training/export/eval script skeletons pinned to the
   `[1, 12]` output contract, plus a contract test asserting any exported `.pte` matches
   `MODEL_OUTPUT_LENGTH` and the `decodeModelOutput` layout.
3. ~~**`decodeToRgb` device contract**~~ — **DONE.** Implemented as `decodeJpegToRgb`
   (`src/features/read/decode-rgb.ts`): pure-JS `jpeg-js` decode, EXIF-orientation corrected, and
   area-averaged downscale to a 512 px working edge. See
   `docs/superpowers/specs/2026-07-25-scan-accuracy-pipeline-design.md` F4/F5.
4. **Fairness-harness adapter for `ExecutorchEngine`** — so the day a real `.pte` exists,
   validation is one command.

## 6. Cutover checklist (when a trained model passes validation)

- [ ] Fairness harness passes on held-out Fitzpatrick I–VI (fail-closed verdicts all true).
- [ ] Calibration/accuracy eval vs labeled data on file (this is the validation-data file
      that any future claim would cite; still no claim ships without founder/legal review).
- [ ] `MODEL_VERSION` bumped; `isStub: false`.
- [ ] `run-read` default flipped to `ExecutorchEngine`; `CvReadEngine` retained as fallback.
- [ ] Personalization baseline restricted to current-`modelVersion` scans (companion spec §7)
      so old-engine scores don't pollute the personal normal across the cutover.
- [ ] `scripts/check-no-image-egress.mjs` + `check:compliance` still green.
- [ ] Physical-iPhone dev-build verification of decode + forward (DEVICE-ONLY markers cleared).

## 7. Explicit non-goals

- No on-device fine-tuning on user images (would make user faces training data — §6 line).
- No cloud inference of any kind (image would cross the boundary).
- No accuracy/equity marketing claim from this work alone; validation data on file is a
  prerequisite for even considering one, and founder/legal review is a second gate after it.
