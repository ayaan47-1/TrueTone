// src/features/read/executorch-engine.ts
//
// NOT LIVE -- FUTURE-MODEL SHELL, DATASET-GATED. This is a scaffold for the trained on-device
// model track approved in docs/superpowers/specs/2026-07-02-trained-model-track-design.md,
// not a device-only build of a model that exists today. Concretely, as of this comment:
//   - `react-native-executorch` is NOT in package.json -- the import below is a compile-time
//     shape reference only (`@ts-expect-error`), never a runtime one.
//   - No `.pte` model asset exists anywhere in this repo (`assets/` doesn't exist under this
//     directory). One is produced by `scripts/export_stub_model.py` (host-runnable, real but
//     deliberately trivial "deep stub" -- see that script's header), which has never been run
//     against this checkout. THIS FILE MUST NEVER `require()` A LITERAL PATH TO THAT ASSET
//     until it actually exists on disk -- Metro resolves `require()` calls statically while
//     building the bundle graph, so a literal require of a missing file breaks the ENTIRE build
//     the moment anything imports this module, not just this feature.
//   - `decodeToRgb` below unconditionally throws; it was never rewritten to use the real,
//     already-live `decodeJpegToRgb` (`decode-rgb.ts`), and doing so is more than a rename --
//     that function returns an `RgbImage` (width/height/RGBA bytes), not the flat 224x224x3
//     `Uint8Array` `normalizeToTensor` expects, so a resize+channel-flatten step still has to be
//     written.
//   - `ExecutorchEngine` has zero live callers: `run-read.ts` always uses `CvReadEngine`.
//     `scripts/check-executorch-unwired.mjs` (run in CI via `npm run test:scripts`) fails the
//     build if that ever changes without a deliberate update to that script alongside it.
// None of this is a bug to "just wire up" -- training is hard-gated on a consented/licensed
// face dataset that does not exist yet (design doc §0/§1, CLAUDE.md §6). This file exists so the
// eventual cutover (design doc §6 checklist) has a documented shape to fill in, not because a
// model is one build step away.
//
// Compliance boundary (CLAUDE.md §3): the raw image is read, decoded, and deleted entirely on
// device; only the derived ScoreVector + skin-type ever leave this module. Nothing is sent to a
// server or third party — enforced statically by scripts/check-no-image-egress.mjs.
//
// API surface confirmed via Context7 (react-native-executorch, 2026-06-17), for whoever wires
// this for real once a dataset and a genuine .pte exist:
//   import { ExecutorchModule, ScalarType, type TensorPtr } from 'react-native-executorch';
//   const model = new ExecutorchModule(); await model.load(require('./assets/stub-model.pte'));
//   const outputs = await model.forward([{ dataPtr, sizes, scalarType: ScalarType.FLOAT }]);
//   const out = new Float32Array(outputs[0].dataPtr);   // outputs[0].sizes === [1, 12]
// (The class form is used rather than the `useExecutorchModule` hook because the engine runs
// outside React render — the route does `new ExecutorchEngine()`.)

// DEVICE-ONLY: expo-file-system resolves in the host workspace (Expo built-in); its native
// behaviour is exercised on-device in the Phase-4 dev build (Task 0.1).
import * as FileSystem from 'expo-file-system';
// DEVICE-ONLY: native module — not resolvable / runnable under Jest or the Simulator.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error react-native-executorch is a Phase-4 native dep installed in the dev build (Task 0.1).
import { ExecutorchModule, ScalarType } from 'react-native-executorch';

import { INPUT_SIZE, normalizeToTensor } from './preprocess';
import { withImageCleanup } from './image-lifecycle';
import { decodeModelOutput, MODEL_OUTPUT_LENGTH } from './decode-output';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';

const MODEL_VERSION = 'stub-1';
// INTENTIONALLY NOT `require('./assets/stub-model.pte')` -- that file does not exist in this
// repo. A literal require of a missing path is resolved by Metro while it builds the bundle
// graph, so it would break the WHOLE APP BUILD (not just this feature) the instant any file
// imports this module -- not a risk worth taking for an asset nobody has generated yet. Run
// `scripts/export_stub_model.py` (host-only, no device needed) to produce a real "deep stub"
// asset, then restore this line, before wiring `ExecutorchEngine` into anything live.
function requireModelSource(): unknown {
  throw new Error(
    'no .pte model asset exists yet -- run scripts/export_stub_model.py to generate one ' +
      '(see docs/superpowers/specs/2026-07-02-trained-model-track-design.md §5-6), then replace ' +
      "this function with `require('./assets/stub-model.pte')`",
  );
}

// NOT LIVE -- see file header. Decodes the captured JPEG to a 224x224 RGB byte buffer (length
// 3*224*224). This is NOT simply "confirm the API on-device": the already-live `decodeJpegToRgb`
// (`decode-rgb.ts`) returns a differently-shaped `RgbImage`, so a resize-to-224 + RGBA→RGB
// flatten step still needs writing on top of it before this can call a real decoder. Returning a
// wrong-length buffer is caught by normalizeToTensor's length guard, which is unit-tested.
async function decodeToRgb(_uri: string): Promise<Uint8Array> {
  throw new Error(
    'decodeToRgb is a not-yet-implemented stub: build it on decodeJpegToRgb (decode-rgb.ts) ' +
      'plus a resize-to-224 + RGB-flatten step, then verify on a physical iPhone',
  );
}

// NOT LIVE -- see file header. Loads the deep-stub .pte once and runs the forward pass. Lazily
// cached so repeated reads in a session reuse the loaded module.
let modulePromise: Promise<{ forward: (inputs: unknown[]) => Promise<Array<{ dataPtr: ArrayBuffer; sizes: number[] }>> }> | null =
  null;

async function loadModelOnce(): Promise<{
  forward: (inputs: unknown[]) => Promise<Array<{ dataPtr: ArrayBuffer; sizes: number[] }>>;
}> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const model = new ExecutorchModule();
      await model.load(requireModelSource());
      return model;
    })();
  }
  return modulePromise;
}

async function runForward(tensor: Float32Array): Promise<Float32Array> {
  // NOT LIVE -- see file header. Native ExecuTorch forward pass; unreachable today because
  // decodeToRgb and loadModelOnce both throw first.
  const model = await loadModelOnce();
  const inputTensor = {
    dataPtr: tensor,
    sizes: [1, 3, INPUT_SIZE, INPUT_SIZE],
    scalarType: ScalarType.FLOAT,
  };
  const outputs = await model.forward([inputTensor]);
  const out = new Float32Array(outputs[0].dataPtr);
  if (out.length !== MODEL_OUTPUT_LENGTH) {
    throw new Error(`model returned ${out.length} values, expected ${MODEL_OUTPUT_LENGTH}`);
  }
  return out;
}

/**
 * NOT LIVE -- future trained-model read engine, dataset-gated (see file header). Every call path
 * currently throws (no package installed, no model asset, decode unimplemented); kept as a
 * documented shape for the eventual cutover, not a device-only build that merely needs testing.
 * The raw image is still deleted via withImageCleanup regardless of success or failure, matching
 * every other read engine's compliance guarantee.
 */
export class ExecutorchEngine implements ReadEngine {
  async run(uri: string): Promise<ReadResult> {
    return withImageCleanup(
      uri,
      async (uri) => {
        const rgb = await decodeToRgb(uri); // DEVICE-ONLY
        const tensor = normalizeToTensor(rgb, INPUT_SIZE, INPUT_SIZE); // pure, tested
        const out = await runForward(tensor); // DEVICE-ONLY
        const { scores, skinType } = decodeModelOutput(out); // pure, tested
        return { scores, skinType, modelVersion: MODEL_VERSION, isStub: true };
      },
      (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    );
  }
}
