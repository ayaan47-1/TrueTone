// src/features/read/executorch-engine.ts
//
// DEVICE-ONLY SHELL — verify on a physical iPhone via an Expo dev build (the Simulator has
// no camera; CLAUDE.md §4). This file is intentionally thin: every line of real logic it relies
// on is a pure, Jest-tested module (preprocess, decode-output, image-lifecycle). The only parts
// that cannot be host-verified are the two native calls below — both are marked
// `// DEVICE-ONLY: verify on physical iPhone` and isolated behind small functions.
//
// Compliance boundary (CLAUDE.md §3): the raw image is read, decoded, and deleted entirely on
// device; only the derived ScoreVector + skin-type ever leave this module. Nothing is sent to a
// server or third party — enforced statically by scripts/check-no-image-egress.mjs.
//
// API surface confirmed via Context7 (react-native-executorch, 2026-06-17):
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
const MODEL_SOURCE = require('./assets/stub-model.pte');

// DEVICE-ONLY: verify on physical iPhone.
// Decodes the captured JPEG to a 224x224 RGB byte buffer (length 3*224*224). The decode/resize
// helper is native — confirm the exact API on-device (a vision-camera resize plugin or an
// executorch image utility) via Context7 before wiring. Returning a wrong-length buffer is caught
// by normalizeToTensor's length guard, which is unit-tested.
async function decodeToRgb(_uri: string): Promise<Uint8Array> {
  // DEVICE-ONLY: verify on physical iPhone — replace with the confirmed native decode+resize call.
  throw new Error(
    'decodeToRgb is a device-only stub: implement against the confirmed native JPEG decode/resize API',
  );
}

// DEVICE-ONLY: verify on physical iPhone.
// Loads the deep-stub .pte once and runs the forward pass. Lazily cached so repeated reads in a
// session reuse the loaded module.
let modulePromise: Promise<{ forward: (inputs: unknown[]) => Promise<Array<{ dataPtr: ArrayBuffer; sizes: number[] }>> }> | null =
  null;

async function loadModelOnce(): Promise<{
  forward: (inputs: unknown[]) => Promise<Array<{ dataPtr: ArrayBuffer; sizes: number[] }>>;
}> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const model = new ExecutorchModule();
      await model.load(MODEL_SOURCE);
      return model;
    })();
  }
  return modulePromise;
}

async function runForward(tensor: Float32Array): Promise<Float32Array> {
  // DEVICE-ONLY: verify on physical iPhone — native ExecuTorch forward pass.
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
 * Real on-device read engine. The two native calls (decode, forward) are device-only stubs/shells;
 * everything between them is pure tested logic. The raw image is deleted via withImageCleanup
 * regardless of success or failure.
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
