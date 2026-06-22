# CV Read Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub read with a classical-CV engine that turns a captured face photo into the existing 8-dimension cosmetic `ScoreVector` + skin type, fully host-tested, and verify the full flow on a physical Android phone.

**Architecture:** A pure TypeScript scoring core (`scoreFromRgb(rgb, bbox)`) over a decoded RGBA buffer — every dimension extractor is a small pure function tested on synthetic fixtures. A thin device wrapper (`CvReadEngine implements ReadEngine`) does the only device-only steps (JPEG→RGB decode + face-bbox detection on the still) and delegates to the core. The compliance boundary and `ReadEngine` seam are unchanged; the `.pte`/executorch shell stays dormant for a future learned v2.

**Tech Stack:** TypeScript, React Native / Expo SDK 56, Jest (jest-expo), react-native-vision-camera v5, expo-image-manipulator (device decode), the existing `eval/fairness` harness.

## Global Constraints

- Cosmetic schema is **frozen** — the 8 dimensions are exactly `['hydration','oiliness','texture','pores','darkSpots','redness','fineLines','darkCircles']` (order from `src/content/cosmetic-vocab.ts`); skin types exactly `['dry','oily','combination','sensitive']`. Do not add, rename, or reorder.
- The engine returns `modelVersion: 'cv-1'` and `isStub: false`.
- The scoring core is **pure TypeScript** over a decoded RGBA `RgbImage`; only `decodeJpegToRgb` and `detectFaceBbox` are device-only. Every other module has host (Jest) tests.
- Each dimension is scored **relative to the user's own cheek baseline** (the fairness keystone): tone-dependent quantities are subtracted out so `bias.ts` FST-correlation stays ≤ 0.2.
- The raw image **never crosses the compliance boundary** — deleted on-device after the read via the existing `withImageCleanup`. No image bytes are logged, uploaded, or sent anywhere.
- **No new SDK/vendor** with access to face/skin/score/health data. (decode uses `expo-image-manipulator`, already an Expo built-in family; face bbox uses the vision-camera face detector already in the project.)
- Target platform for the device pass: **Android only**.
- **No public accuracy / efficacy / skin-tone-equity claim** ships from this work; real-world fairness validation is the separate, legally-gated sub-project D.
- `hydration` and `pores` are coarse v1 proxies — say so in code comments; do not over-claim.
- All existing compliance gates must still pass: `npm test`, `npm run check:compliance`, `npm run check:no-egress`.

## File Structure

All new pure modules live under `src/features/read/cv/`:

- `types.ts` — `RgbImage`, `Rect`, `Regions`, `SkinBaseline`, `Lab`.
- `fixtures.ts` — synthetic `RgbImage` builders for tests + the fairness self-test (`solidRgb`, `fillRect`, `addNoise`, `vStripes`).
- `color.ts` — `srgbToLab`.
- `sampling.ts` — pixel/region helpers: `clampRect`, `rgbAt`, `lumaAt`, `meanLab`, `median`, `laplacianEnergy`, `gradientEnergy`, `localContrastDensity`.
- `calibration.ts` — `norm01`, `REGION_PROPORTIONS`, `CAL` (per-dimension constants).
- `regions.ts` — `deriveRegions(bbox, size)`.
- `baseline.ts` — `sampleBaseline(rgb, regions)`.
- `dimensions/redness.ts`, `darkCircles.ts`, `oiliness.ts`, `texture.ts`, `pores.ts`, `fineLines.ts`, `darkSpots.ts`, `hydration.ts` — one extractor each.
- `skin-type.ts` — `classify(scores)`.
- `score-from-rgb.ts` — pure orchestrator + `CV_MODEL_VERSION`.

Device + wiring:

- `src/features/read/decode-rgb.ts` — device-only `decodeJpegToRgb(uri)`.
- `src/features/read/detect-bbox.ts` — device-only `detectFaceBbox(uri)`.
- `src/features/read/cv-read-engine.ts` — `CvReadEngine implements ReadEngine` (injectable deps).
- `src/features/read/run-read.ts` — replaces `run-stub-read.ts` as the capture-flow entry.
- `eval/fairness/self-test-images.ts` + `eval/fairness/cv-extractor.ts` — fairness self-test.
- Modify: `app/scan/index.tsx` (call `runRead`), `src/features/capture/use-frame-metrics.ts` (`FRAME_PROCESSORS_INSTALLED = true`).

---

### Task 1: Shared CV types

**Files:**
- Create: `src/features/read/cv/types.ts`
- Test: `src/features/read/cv/__tests__/types.test.ts`

**Interfaces:**
- Produces: `RgbImage { width: number; height: number; data: Uint8ClampedArray }` (RGBA, length `width*height*4`); `Rect { x: number; y: number; w: number; h: number }`; `SkinBaseline { L: number; a: number; b: number }`; `Lab { L: number; a: number; b: number }`; `Regions` with keys `cheekL, cheekR, infraorbitalL, infraorbitalR, forehead, periocularL, periocularR, tZone` each a `Rect`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/types.test.ts
import type { RgbImage, Rect, Regions, SkinBaseline, Lab } from '../types';
import { REGION_NAMES } from '../types';

test('REGION_NAMES lists all eight face regions', () => {
  expect([...REGION_NAMES].sort()).toEqual(
    ['cheekL', 'cheekR', 'forehead', 'infraorbitalL', 'infraorbitalR', 'periocularL', 'periocularR', 'tZone'].sort(),
  );
});

test('types are structurally usable', () => {
  const r: Rect = { x: 0, y: 0, w: 1, h: 1 };
  const img: RgbImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  const b: SkinBaseline = { L: 50, a: 5, b: 10 };
  const lab: Lab = { L: 50, a: 5, b: 10 };
  const _regionKey: keyof Regions = 'cheekL';
  expect(img.data).toHaveLength(4);
  expect([r.w, b.L, lab.L, _regionKey]).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/types.test.ts`
Expected: FAIL — `Cannot find module '../types'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/types.ts
// Shared structural types for the classical-CV read. RgbImage is an RGBA buffer
// (4 bytes/pixel) as produced by the device JPEG decode; everything downstream is pure.
export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface RgbImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, length === width * height * 4
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SkinBaseline = Lab;

export const REGION_NAMES = [
  'cheekL',
  'cheekR',
  'infraorbitalL',
  'infraorbitalR',
  'forehead',
  'periocularL',
  'periocularR',
  'tZone',
] as const;

export type RegionName = (typeof REGION_NAMES)[number];
export type Regions = Record<RegionName, Rect>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/types.ts src/features/read/cv/__tests__/types.test.ts
git commit -m "feat(read): CV shared types"
```

---

### Task 2: Synthetic image fixtures

**Files:**
- Create: `src/features/read/cv/fixtures.ts`
- Test: `src/features/read/cv/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Rect` (Task 1).
- Produces: `solidRgb(width, height, rgb?: [number,number,number]): RgbImage`; `fillRect(img: RgbImage, rect: Rect, rgb: [number,number,number]): RgbImage`; `addNoise(img: RgbImage, rect: Rect, amp: number, seed?: number): RgbImage`; `vStripes(img: RgbImage, rect: Rect, drop: number): RgbImage`. All return a NEW image (no mutation).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/fixtures.test.ts
import { solidRgb, fillRect, addNoise, vStripes } from '../fixtures';

const BASE: [number, number, number] = [180, 140, 120];

test('solidRgb fills every pixel with the colour and opaque alpha', () => {
  const img = solidRgb(2, 2, BASE);
  expect(img.data).toHaveLength(2 * 2 * 4);
  expect([img.data[0], img.data[1], img.data[2], img.data[3]]).toEqual([180, 140, 120, 255]);
});

test('fillRect returns a new image and paints only the rect', () => {
  const img = solidRgb(4, 4, BASE);
  const out = fillRect(img, { x: 1, y: 1, w: 2, h: 2 }, [10, 20, 30]);
  expect(out).not.toBe(img);
  expect(img.data[0]).toBe(180); // original untouched
  const inside = (1 * 4 + 1) * 4;
  expect([out.data[inside], out.data[inside + 1], out.data[inside + 2]]).toEqual([10, 20, 30]);
  expect(out.data[0]).toBe(180); // pixel (0,0) outside the rect
});

test('addNoise is deterministic for a fixed seed', () => {
  const img = solidRgb(8, 8, BASE);
  const a = addNoise(img, { x: 0, y: 0, w: 8, h: 8 }, 20, 7);
  const b = addNoise(img, { x: 0, y: 0, w: 8, h: 8 }, 20, 7);
  expect(Array.from(a.data)).toEqual(Array.from(b.data));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/fixtures.test.ts`
Expected: FAIL — `Cannot find module '../fixtures'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/fixtures.ts
// Deterministic synthetic RgbImage builders for unit tests and the fairness self-test.
// All builders return a NEW image (immutability rule). Bounds are clamped inline so this
// module depends only on types (no import cycle with sampling).
import type { RgbImage, Rect } from './types';

type Rgb = [number, number, number];

function clone(img: RgbImage): RgbImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

function bounds(img: RgbImage, r: Rect) {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(img.width, Math.floor(r.x + r.w));
  const y1 = Math.min(img.height, Math.floor(r.y + r.h));
  return { x0, y0, x1, y1 };
}

export function solidRgb(width: number, height: number, rgb: Rgb = [180, 140, 120]): RgbImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

export function fillRect(img: RgbImage, rect: Rect, rgb: Rgb): RgbImage {
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      out.data[i] = rgb[0];
      out.data[i + 1] = rgb[1];
      out.data[i + 2] = rgb[2];
      out.data[i + 3] = 255;
    }
  }
  return out;
}

export function addNoise(img: RgbImage, rect: Rect, amp: number, seed = 1): RgbImage {
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const d = (rnd() * 2 - 1) * amp;
      out.data[i] = img.data[i] + d;
      out.data[i + 1] = img.data[i + 1] + d;
      out.data[i + 2] = img.data[i + 2] + d;
    }
  }
  return out;
}

export function vStripes(img: RgbImage, rect: Rect, drop: number): RgbImage {
  // Darken every other column inside the rect — a strong horizontal-gradient signal.
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x % 2 === 0) continue;
      const i = (y * img.width + x) * 4;
      out.data[i] = img.data[i] - drop;
      out.data[i + 1] = img.data[i + 1] - drop;
      out.data[i + 2] = img.data[i + 2] - drop;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/fixtures.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/fixtures.ts src/features/read/cv/__tests__/fixtures.test.ts
git commit -m "feat(read): synthetic CV image fixtures"
```

---

### Task 3: sRGB → CIELAB

**Files:**
- Create: `src/features/read/cv/color.ts`
- Test: `src/features/read/cv/__tests__/color.test.ts`

**Interfaces:**
- Consumes: `Lab` (Task 1).
- Produces: `srgbToLab(r: number, g: number, b: number): Lab` (inputs 0..255).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/color.test.ts
import { srgbToLab } from '../color';

test('white maps to L≈100, a≈0, b≈0', () => {
  const { L, a, b } = srgbToLab(255, 255, 255);
  expect(L).toBeCloseTo(100, 0);
  expect(a).toBeCloseTo(0, 0);
  expect(b).toBeCloseTo(0, 0);
});

test('black maps to L≈0', () => {
  expect(srgbToLab(0, 0, 0).L).toBeCloseTo(0, 1);
});

test('pure red has strongly positive a*', () => {
  expect(srgbToLab(255, 0, 0).a).toBeGreaterThan(50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/color.test.ts`
Expected: FAIL — `Cannot find module '../color'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/color.ts
// sRGB (0..255) → CIELAB (D65). L* lightness, a* green↔red, b* blue↔yellow.
// a* is the redness axis; L* drives dark-circle/dark-spot deltas. Pure + standard.
import type { Lab } from './types';

const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/color.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/color.ts src/features/read/cv/__tests__/color.test.ts
git commit -m "feat(read): sRGB to CIELAB conversion"
```

---

### Task 4: Pixel & region sampling helpers

**Files:**
- Create: `src/features/read/cv/sampling.ts`
- Test: `src/features/read/cv/__tests__/sampling.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Rect`, `Lab` (Task 1); `srgbToLab` (Task 3); fixtures (Task 2, test only).
- Produces: `clampRect(r: Rect, w: number, h: number): Rect`; `rgbAt(img, x, y): [number,number,number]`; `lumaAt(img, x, y): number` (0..1); `meanLab(img, rect): Lab`; `median(xs: number[]): number`; `laplacianEnergy(img, rect): number`; `gradientEnergy(img, rect): number`; `localContrastDensity(img, rect, thr: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/sampling.test.ts
import { clampRect, lumaAt, meanLab, median, laplacianEnergy, gradientEnergy, localContrastDensity } from '../sampling';
import { solidRgb, addNoise } from '../fixtures';

const FULL = (w: number, h: number) => ({ x: 0, y: 0, w, h });

test('clampRect keeps the rect inside the image', () => {
  expect(clampRect({ x: -5, y: -5, w: 100, h: 100 }, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
});

test('lumaAt of white is ≈1, black is 0', () => {
  expect(lumaAt(solidRgb(1, 1, [255, 255, 255]), 0, 0)).toBeCloseTo(1, 3);
  expect(lumaAt(solidRgb(1, 1, [0, 0, 0]), 0, 0)).toBe(0);
});

test('meanLab of a solid patch matches its colour', () => {
  expect(meanLab(solidRgb(4, 4, [255, 255, 255]), FULL(4, 4)).L).toBeCloseTo(100, 0);
});

test('median handles odd and even lengths', () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
});

test('laplacianEnergy is ~0 on a flat patch and rises with noise', () => {
  const flat = solidRgb(16, 16, [180, 140, 120]);
  const noisy = addNoise(flat, FULL(16, 16), 30, 5);
  expect(laplacianEnergy(flat, FULL(16, 16))).toBeCloseTo(0, 5);
  expect(laplacianEnergy(noisy, FULL(16, 16))).toBeGreaterThan(laplacianEnergy(flat, FULL(16, 16)));
});

test('gradientEnergy and localContrastDensity rise with noise', () => {
  const flat = solidRgb(16, 16, [180, 140, 120]);
  const noisy = addNoise(flat, FULL(16, 16), 30, 9);
  expect(gradientEnergy(noisy, FULL(16, 16))).toBeGreaterThan(gradientEnergy(flat, FULL(16, 16)));
  expect(localContrastDensity(noisy, FULL(16, 16), 0.06)).toBeGreaterThan(0);
  expect(localContrastDensity(flat, FULL(16, 16), 0.06)).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/sampling.test.ts`
Expected: FAIL — `Cannot find module '../sampling'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/sampling.ts
// Pure pixel/region readers over an RGBA RgbImage. All region functions clamp to bounds.
import type { RgbImage, Rect, Lab } from './types';
import { srgbToLab } from './color';

export function clampRect(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(Math.round(r.x), w - 1));
  const y = Math.max(0, Math.min(Math.round(r.y), h - 1));
  const rw = Math.max(1, Math.min(Math.round(r.w), w - x));
  const rh = Math.max(1, Math.min(Math.round(r.h), h - y));
  return { x, y, w: rw, h: rh };
}

export function rgbAt(img: RgbImage, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function lumaAt(img: RgbImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
}

export function meanLab(img: RgbImage, rect: Rect): Lab {
  const r = clampRect(rect, img.width, img.height);
  let L = 0;
  let a = 0;
  let b = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      const lab = srgbToLab(rr, gg, bb);
      L += lab.L;
      a += lab.a;
      b += lab.b;
      n++;
    }
  }
  return { L: L / n, a: a / n, b: b / n };
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function laplacianEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const lap =
        4 * lumaAt(img, x, y) -
        lumaAt(img, x - 1, y) -
        lumaAt(img, x + 1, y) -
        lumaAt(img, x, y - 1) -
        lumaAt(img, x, y + 1);
      sum += Math.abs(lap);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function gradientEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x + 1; x < r.x + r.w; x++) {
      sum += Math.abs(lumaAt(img, x, y) - lumaAt(img, x - 1, y));
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function localContrastDensity(img: RgbImage, rect: Rect, thr: number): number {
  const r = clampRect(rect, img.width, img.height);
  let count = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const localMean =
        (lumaAt(img, x - 1, y) + lumaAt(img, x + 1, y) + lumaAt(img, x, y - 1) + lumaAt(img, x, y + 1)) / 4;
      if (Math.abs(lumaAt(img, x, y) - localMean) > thr) count++;
      n++;
    }
  }
  return n ? count / n : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/sampling.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/sampling.ts src/features/read/cv/__tests__/sampling.test.ts
git commit -m "feat(read): CV pixel and region sampling helpers"
```

---

### Task 5: Calibration constants

**Files:**
- Create: `src/features/read/cv/calibration.ts`
- Test: `src/features/read/cv/__tests__/calibration.test.ts`

**Interfaces:**
- Produces: `norm01(raw: number, lo: number, hi: number): number` (clamped 0..1); `REGION_PROPORTIONS: Record<RegionName, [number,number,number,number]>` (fractions `[fx,fy,fw,fh]` of the bbox); `CAL` — `{ redness:{lo,hi}; darkCircles:{lo,hi}; oiliness:{lumaThr,satThr,lo,hi}; texture:{lo,hi}; pores:{thr,lo,hi}; fineLines:{lo,hi}; darkSpots:{dL,lo,hi}; hydration:{lo,hi} }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/calibration.test.ts
import { norm01, REGION_PROPORTIONS, CAL } from '../calibration';
import { REGION_NAMES } from '../types';

test('norm01 clamps to [0,1]', () => {
  expect(norm01(5, 0, 10)).toBeCloseTo(0.5, 5);
  expect(norm01(-3, 0, 10)).toBe(0);
  expect(norm01(99, 0, 10)).toBe(1);
});

test('REGION_PROPORTIONS defines all eight regions as 4-tuples of fractions', () => {
  for (const name of REGION_NAMES) {
    const p = REGION_PROPORTIONS[name];
    expect(p).toHaveLength(4);
    for (const f of p) expect(f).toBeGreaterThanOrEqual(0);
    expect(p[0] + p[2]).toBeLessThanOrEqual(1.001); // x + w stays within the bbox
    expect(p[1] + p[3]).toBeLessThanOrEqual(1.001); // y + h stays within the bbox
  }
});

test('CAL exposes a calibration entry for every dimension', () => {
  expect(Object.keys(CAL).sort()).toEqual(
    ['darkCircles', 'darkSpots', 'fineLines', 'hydration', 'oiliness', 'pores', 'redness', 'texture'].sort(),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/calibration.test.ts`
Expected: FAIL — `Cannot find module '../calibration'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/calibration.ts
// Central calibration: region geometry (fractions of the face bbox) and per-dimension
// normalization ranges. Tuned against synthetic fixtures + the fairness self-test (Task 18).
// Keeping every magic number here means tuning never edits an extractor.
import type { RegionName } from './types';

export const norm01 = (raw: number, lo: number, hi: number): number =>
  Math.min(1, Math.max(0, (raw - lo) / (hi - lo)));

// [fx, fy, fw, fh] as fractions of the bbox. Non-overlapping in x where it matters
// (tZone is a central strip; cheeks flank it; infraorbital sits above the cheeks).
export const REGION_PROPORTIONS: Record<RegionName, [number, number, number, number]> = {
  forehead: [0.25, 0.05, 0.5, 0.15],
  periocularL: [0.12, 0.3, 0.2, 0.12],
  periocularR: [0.68, 0.3, 0.2, 0.12],
  infraorbitalL: [0.18, 0.45, 0.18, 0.08],
  infraorbitalR: [0.64, 0.45, 0.18, 0.08],
  cheekL: [0.15, 0.55, 0.2, 0.18],
  cheekR: [0.65, 0.55, 0.2, 0.18],
  tZone: [0.4, 0.3, 0.2, 0.45],
};

export const CAL = {
  redness: { lo: 0, hi: 25 }, // Δa* over baseline
  darkCircles: { lo: 0, hi: 25 }, // ΔL* deficit vs baseline
  oiliness: { lumaThr: 0.8, satThr: 0.15, lo: 0, hi: 0.25 }, // bright low-sat fraction
  texture: { lo: 0, hi: 0.15 }, // mean |laplacian|
  pores: { thr: 0.06, lo: 0, hi: 0.3 }, // local-contrast density
  fineLines: { lo: 0, hi: 0.12 }, // mean horizontal gradient
  darkSpots: { dL: 12, lo: 0, hi: 0.15 }, // fraction darker than baseline by dL
  hydration: { lo: 0, hi: 0.15 }, // inverse micro-texture
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/calibration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/calibration.ts src/features/read/cv/__tests__/calibration.test.ts
git commit -m "feat(read): CV calibration constants"
```

---

### Task 6: Region derivation from bbox

**Files:**
- Create: `src/features/read/cv/regions.ts`
- Test: `src/features/read/cv/__tests__/regions.test.ts`

**Interfaces:**
- Consumes: `Rect`, `Regions`, `REGION_NAMES` (Task 1); `REGION_PROPORTIONS` (Task 5); `clampRect` (Task 4).
- Produces: `deriveRegions(bbox: Rect, size: { width: number; height: number }): Regions`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/regions.test.ts
import { deriveRegions } from '../regions';
import { REGION_NAMES } from '../types';

test('every region falls inside the image bounds', () => {
  const regions = deriveRegions({ x: 10, y: 20, w: 100, h: 120 }, { width: 200, height: 200 });
  for (const name of REGION_NAMES) {
    const r = regions[name];
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(200);
    expect(r.y + r.h).toBeLessThanOrEqual(200);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  }
});

test('tZone sits between the two cheeks horizontally', () => {
  const regions = deriveRegions({ x: 0, y: 0, w: 100, h: 100 }, { width: 100, height: 100 });
  expect(regions.cheekL.x).toBeLessThan(regions.tZone.x);
  expect(regions.tZone.x + regions.tZone.w).toBeLessThanOrEqual(regions.cheekR.x + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/regions.test.ts`
Expected: FAIL — `Cannot find module '../regions'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/regions.ts
// Turns the face detector's bounding box into fixed sub-rectangles via fixed proportions.
// No landmarks in v1 (spec §2). Every rect is clamped to the image.
import type { Rect, Regions, RegionName } from './types';
import { REGION_NAMES } from './types';
import { REGION_PROPORTIONS } from './calibration';
import { clampRect } from './sampling';

export function deriveRegions(bbox: Rect, size: { width: number; height: number }): Regions {
  const mk = (name: RegionName): Rect => {
    const [fx, fy, fw, fh] = REGION_PROPORTIONS[name];
    return clampRect(
      { x: bbox.x + fx * bbox.w, y: bbox.y + fy * bbox.h, w: fw * bbox.w, h: fh * bbox.h },
      size.width,
      size.height,
    );
  };
  return Object.fromEntries(REGION_NAMES.map((name) => [name, mk(name)])) as Regions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/regions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/regions.ts src/features/read/cv/__tests__/regions.test.ts
git commit -m "feat(read): derive face regions from bbox"
```

---

### Task 7: Skin baseline sampling

**Files:**
- Create: `src/features/read/cv/baseline.ts`
- Test: `src/features/read/cv/__tests__/baseline.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions`, `SkinBaseline` (Task 1); `srgbToLab` (Task 3); `clampRect`, `rgbAt`, `median` (Task 4).
- Produces: `sampleBaseline(img: RgbImage, regions: Regions): SkinBaseline` — robust (median) L\*/a\*/b\* over both cheek patches.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/baseline.test.ts
import { sampleBaseline } from '../baseline';
import { deriveRegions } from '../regions';
import { solidRgb, fillRect } from '../fixtures';
import { srgbToLab } from '../color';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('baseline of uniform skin matches that skin colour', () => {
  const img = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(img, deriveRegions(BBOX, SIZE));
  const expected = srgbToLab(180, 140, 120);
  expect(baseline.L).toBeCloseTo(expected.L, 0);
  expect(baseline.a).toBeCloseTo(expected.a, 0);
});

test('a small dark blot in one cheek does not move the median much (robustness)', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clean = solidRgb(100, 100, [180, 140, 120]);
  const blotted = fillRect(clean, { x: regions.cheekR.x, y: regions.cheekR.y, w: 3, h: 3 }, [20, 20, 20]);
  const a = sampleBaseline(clean, regions);
  const b = sampleBaseline(blotted, regions);
  expect(Math.abs(a.L - b.L)).toBeLessThan(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/baseline.test.ts`
Expected: FAIL — `Cannot find module '../baseline'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/baseline.ts
// The fairness keystone: a robust per-person skin baseline in CIELAB, sampled from both
// cheeks. Every tone-dependent dimension subtracts this so skin tone cancels out.
import type { RgbImage, Regions, SkinBaseline } from './types';
import { srgbToLab } from './color';
import { clampRect, rgbAt, median } from './sampling';

export function sampleBaseline(img: RgbImage, regions: Regions): SkinBaseline {
  const Ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  for (const rect of [regions.cheekL, regions.cheekR]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const [rr, gg, bb] = rgbAt(img, x, y);
        const lab = srgbToLab(rr, gg, bb);
        Ls.push(lab.L);
        as.push(lab.a);
        bs.push(lab.b);
      }
    }
  }
  return { L: median(Ls), a: median(as), b: median(bs) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/baseline.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/baseline.ts src/features/read/cv/__tests__/baseline.test.ts
git commit -m "feat(read): robust skin baseline sampling"
```

---

### Task 8: redness extractor

**Files:**
- Create: `src/features/read/cv/dimensions/redness.ts`
- Test: `src/features/read/cv/dimensions/__tests__/redness.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions`, `SkinBaseline` (Task 1); `meanLab` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `redness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number` (0..1) — `norm01(meanLab(tZone).a − baseline.a)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/redness.test.ts
import { redness } from '../redness';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('redness rises when the T-zone is reddened, vs a neutral face', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const neutral = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(neutral, regions); // cheeks neutral
  const reddened = fillRect(neutral, regions.tZone, [210, 110, 100]);

  const rNeutral = redness(neutral, regions, baseline);
  const rRed = redness(reddened, regions, baseline);

  expect(rRed).toBeGreaterThan(rNeutral);
  expect(rNeutral).toBeGreaterThanOrEqual(0);
  expect(rRed).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/redness.test.ts`
Expected: FAIL — `Cannot find module '../redness'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/redness.ts
// Redness = elevation of a* in the central T-zone relative to the person's own baseline a*.
// Baseline-relative ⇒ skin tone cancels (fairness).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { meanLab } from '../sampling';
import { norm01, CAL } from '../calibration';

export function redness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const a = meanLab(img, regions.tZone).a;
  return norm01(a - baseline.a, CAL.redness.lo, CAL.redness.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/redness.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/redness.ts src/features/read/cv/dimensions/__tests__/redness.test.ts
git commit -m "feat(read): redness extractor"
```

---

### Task 9: darkCircles extractor

**Files:**
- Create: `src/features/read/cv/dimensions/darkCircles.ts`
- Test: `src/features/read/cv/dimensions/__tests__/darkCircles.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions`, `SkinBaseline` (Task 1); `meanLab` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `darkCircles(img, regions, baseline): number` — `norm01(baseline.L − mean(infraorbital L))`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/darkCircles.test.ts
import { darkCircles } from '../darkCircles';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('darkCircles rises when the under-eye regions are darkened', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const neutral = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(neutral, regions);
  let dark = fillRect(neutral, regions.infraorbitalL, [120, 95, 82]);
  dark = fillRect(dark, regions.infraorbitalR, [120, 95, 82]);

  expect(darkCircles(dark, regions, baseline)).toBeGreaterThan(darkCircles(neutral, regions, baseline));
  expect(darkCircles(neutral, regions, baseline)).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/darkCircles.test.ts`
Expected: FAIL — `Cannot find module '../darkCircles'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/darkCircles.ts
// Dark circles = how much darker the infraorbital regions are than the cheek baseline (ΔL*).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { meanLab } from '../sampling';
import { norm01, CAL } from '../calibration';

export function darkCircles(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const infra = (meanLab(img, regions.infraorbitalL).L + meanLab(img, regions.infraorbitalR).L) / 2;
  return norm01(baseline.L - infra, CAL.darkCircles.lo, CAL.darkCircles.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/darkCircles.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/darkCircles.ts src/features/read/cv/dimensions/__tests__/darkCircles.test.ts
git commit -m "feat(read): darkCircles extractor"
```

---

### Task 10: oiliness extractor

**Files:**
- Create: `src/features/read/cv/dimensions/oiliness.ts`
- Test: `src/features/read/cv/dimensions/__tests__/oiliness.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions` (Task 1); `clampRect`, `rgbAt`, `lumaAt` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `oiliness(img: RgbImage, regions: Regions): number` — fraction of bright, low-saturation pixels in the T-zone.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/oiliness.test.ts
import { oiliness } from '../oiliness';
import { deriveRegions } from '../../regions';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('oiliness rises with specular highlights in the T-zone', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const matte = solidRgb(100, 100, [180, 140, 120]);
  const shiny = fillRect(matte, regions.tZone, [250, 250, 250]);

  expect(oiliness(shiny, regions)).toBeGreaterThan(oiliness(matte, regions));
  expect(oiliness(matte, regions)).toBeGreaterThanOrEqual(0);
  expect(oiliness(shiny, regions)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/oiliness.test.ts`
Expected: FAIL — `Cannot find module '../oiliness'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/oiliness.ts
// Oiliness = fraction of T-zone pixels that read as specular highlight (bright + low saturation).
import type { RgbImage, Regions } from '../types';
import { clampRect, rgbAt, lumaAt } from '../sampling';
import { norm01, CAL } from '../calibration';

export function oiliness(img: RgbImage, regions: Regions): number {
  const r = clampRect(regions.tZone, img.width, img.height);
  let hi = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [R, G, B] = rgbAt(img, x, y);
      const mx = Math.max(R, G, B);
      const mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      if (lumaAt(img, x, y) > CAL.oiliness.lumaThr && sat < CAL.oiliness.satThr) hi++;
      n++;
    }
  }
  return norm01(n ? hi / n : 0, CAL.oiliness.lo, CAL.oiliness.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/oiliness.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/oiliness.ts src/features/read/cv/dimensions/__tests__/oiliness.test.ts
git commit -m "feat(read): oiliness extractor"
```

---

### Task 11: texture extractor

**Files:**
- Create: `src/features/read/cv/dimensions/texture.ts`
- Test: `src/features/read/cv/dimensions/__tests__/texture.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions` (Task 1); `laplacianEnergy` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `texture(img: RgbImage, regions: Regions): number` — normalized Laplacian energy over the forehead.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/texture.test.ts
import { texture } from '../texture';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('texture rises when forehead skin is rougher (high-frequency noise)', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  const rough = addNoise(smooth, regions.forehead, 35, 3);

  expect(texture(rough, regions)).toBeGreaterThan(texture(smooth, regions));
  expect(texture(smooth, regions)).toBeGreaterThanOrEqual(0);
  expect(texture(rough, regions)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/texture.test.ts`
Expected: FAIL — `Cannot find module '../texture'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/texture.ts
// Texture = high-frequency (Laplacian) energy over forehead skin — rougher skin ⇒ higher.
import type { RgbImage, Regions } from '../types';
import { laplacianEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function texture(img: RgbImage, regions: Regions): number {
  return norm01(laplacianEnergy(img, regions.forehead), CAL.texture.lo, CAL.texture.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/texture.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/texture.ts src/features/read/cv/dimensions/__tests__/texture.test.ts
git commit -m "feat(read): texture extractor"
```

---

### Task 12: pores extractor

**Files:**
- Create: `src/features/read/cv/dimensions/pores.ts`
- Test: `src/features/read/cv/dimensions/__tests__/pores.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions` (Task 1); `localContrastDensity` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `pores(img: RgbImage, regions: Regions): number` — local-contrast blob density in the T-zone. **Coarse v1 proxy.**

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/pores.test.ts
import { pores } from '../pores';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('pores rises with fine speckle in the T-zone', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clear = solidRgb(100, 100, [180, 140, 120]);
  const speckled = addNoise(clear, regions.tZone, 40, 11);

  expect(pores(speckled, regions)).toBeGreaterThan(pores(clear, regions));
  expect(pores(clear, regions)).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/pores.test.ts`
Expected: FAIL — `Cannot find module '../pores'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/pores.ts
// Pores = density of small local-contrast features in the T-zone. Coarse v1 proxy (spec §10).
import type { RgbImage, Regions } from '../types';
import { localContrastDensity } from '../sampling';
import { norm01, CAL } from '../calibration';

export function pores(img: RgbImage, regions: Regions): number {
  const density = localContrastDensity(img, regions.tZone, CAL.pores.thr);
  return norm01(density, CAL.pores.lo, CAL.pores.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/pores.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/pores.ts src/features/read/cv/dimensions/__tests__/pores.test.ts
git commit -m "feat(read): pores extractor"
```

---

### Task 13: fineLines extractor

**Files:**
- Create: `src/features/read/cv/dimensions/fineLines.ts`
- Test: `src/features/read/cv/dimensions/__tests__/fineLines.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions` (Task 1); `gradientEnergy` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `fineLines(img: RgbImage, regions: Regions): number` — mean horizontal gradient over the periocular regions.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/fineLines.test.ts
import { fineLines } from '../fineLines';
import { deriveRegions } from '../../regions';
import { solidRgb, vStripes } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('fineLines rises with line-like structure around the eyes', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  let lined = vStripes(smooth, regions.periocularL, 60);
  lined = vStripes(lined, regions.periocularR, 60);

  expect(fineLines(lined, regions)).toBeGreaterThan(fineLines(smooth, regions));
  expect(fineLines(smooth, regions)).toBeGreaterThanOrEqual(0);
  expect(fineLines(lined, regions)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/fineLines.test.ts`
Expected: FAIL — `Cannot find module '../fineLines'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/fineLines.ts
// Fine lines = oriented (horizontal) gradient energy around the eyes.
import type { RgbImage, Regions } from '../types';
import { gradientEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function fineLines(img: RgbImage, regions: Regions): number {
  const e = (gradientEnergy(img, regions.periocularL) + gradientEnergy(img, regions.periocularR)) / 2;
  return norm01(e, CAL.fineLines.lo, CAL.fineLines.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/fineLines.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/fineLines.ts src/features/read/cv/dimensions/__tests__/fineLines.test.ts
git commit -m "feat(read): fineLines extractor"
```

---

### Task 14: darkSpots extractor

**Files:**
- Create: `src/features/read/cv/dimensions/darkSpots.ts`
- Test: `src/features/read/cv/dimensions/__tests__/darkSpots.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions`, `SkinBaseline` (Task 1); `srgbToLab` (Task 3); `clampRect`, `rgbAt` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `darkSpots(img: RgbImage, regions: Regions, baseline: SkinBaseline): number` — max over cheeks+forehead of the fraction of pixels darker than baseline L\* by `CAL.darkSpots.dL`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/darkSpots.test.ts
import { darkSpots } from '../darkSpots';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('darkSpots rises with localized hyperpigmentation on the forehead', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clear = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(clear, regions); // cheeks unaffected
  const spot = fillRect(clear, { x: regions.forehead.x + 2, y: regions.forehead.y + 2, w: 6, h: 6 }, [120, 92, 80]);

  expect(darkSpots(spot, regions, baseline)).toBeGreaterThan(darkSpots(clear, regions, baseline));
  expect(darkSpots(clear, regions, baseline)).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/darkSpots.test.ts`
Expected: FAIL — `Cannot find module '../darkSpots'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/darkSpots.ts
// Dark spots = fraction of facial-skin pixels meaningfully darker than the person's own
// baseline L* (so tone cancels). Reported as the worst of cheeks + forehead.
import type { RgbImage, Regions, SkinBaseline, Rect } from '../types';
import { srgbToLab } from '../color';
import { clampRect, rgbAt } from '../sampling';
import { norm01, CAL } from '../calibration';

function darkFraction(img: RgbImage, rect: Rect, baselineL: number): number {
  const r = clampRect(rect, img.width, img.height);
  let dark = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      if (baselineL - srgbToLab(rr, gg, bb).L > CAL.darkSpots.dL) dark++;
      n++;
    }
  }
  return n ? dark / n : 0;
}

export function darkSpots(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const worst = Math.max(
    darkFraction(img, regions.cheekL, baseline.L),
    darkFraction(img, regions.cheekR, baseline.L),
    darkFraction(img, regions.forehead, baseline.L),
  );
  return norm01(worst, CAL.darkSpots.lo, CAL.darkSpots.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/darkSpots.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/darkSpots.ts src/features/read/cv/dimensions/__tests__/darkSpots.test.ts
git commit -m "feat(read): darkSpots extractor"
```

---

### Task 15: hydration extractor

**Files:**
- Create: `src/features/read/cv/dimensions/hydration.ts`
- Test: `src/features/read/cv/dimensions/__tests__/hydration.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Regions` (Task 1); `laplacianEnergy` (Task 4); `norm01`, `CAL` (Task 5).
- Produces: `hydration(img: RgbImage, regions: Regions): number` — `1 − norm01(forehead micro-texture)`. **Coarse v1 proxy.**

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/dimensions/__tests__/hydration.test.ts
import { hydration } from '../hydration';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('smoother skin reads as more hydrated than rough skin', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  const rough = addNoise(smooth, regions.forehead, 35, 17);

  expect(hydration(smooth, regions)).toBeGreaterThan(hydration(rough, regions));
  expect(hydration(rough, regions)).toBeGreaterThanOrEqual(0);
  expect(hydration(smooth, regions)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/hydration.test.ts`
Expected: FAIL — `Cannot find module '../hydration'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/dimensions/hydration.ts
// Hydration is the softest CV signal (spec §10): a proxy from fine-scale smoothness —
// smoother forehead skin ⇒ higher apparent hydration. Inverse of micro-texture energy.
import type { RgbImage, Regions } from '../types';
import { laplacianEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function hydration(img: RgbImage, regions: Regions): number {
  return 1 - norm01(laplacianEnergy(img, regions.forehead), CAL.hydration.lo, CAL.hydration.hi);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/dimensions/__tests__/hydration.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/dimensions/hydration.ts src/features/read/cv/dimensions/__tests__/hydration.test.ts
git commit -m "feat(read): hydration extractor"
```

---

### Task 16: Skin-type classifier

**Files:**
- Create: `src/features/read/cv/skin-type.ts`
- Test: `src/features/read/cv/__tests__/skin-type.test.ts`

**Interfaces:**
- Consumes: `ScoreVector`, `SkinTypeFeel` (`src/features/read/read-types.ts`).
- Produces: `classify(scores: ScoreVector): SkinTypeFeel`. Rules in order: `redness ≥ 0.6 → 'sensitive'`; `oiliness ≥ 0.6 → 'oily'`; `hydration ≤ 0.35 → 'dry'`; else `'combination'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/skin-type.test.ts
import { classify } from '../skin-type';
import type { ScoreVector } from '../../read-types';

const base: ScoreVector = {
  hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
  darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
};

test('high redness reads as sensitive', () => {
  expect(classify({ ...base, redness: 0.7 })).toBe('sensitive');
});
test('high oiliness (low redness) reads as oily', () => {
  expect(classify({ ...base, oiliness: 0.7, redness: 0.3 })).toBe('oily');
});
test('low hydration (low oiliness/redness) reads as dry', () => {
  expect(classify({ ...base, hydration: 0.2, oiliness: 0.3, redness: 0.3 })).toBe('dry');
});
test('mid values default to combination', () => {
  expect(classify(base)).toBe('combination');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/skin-type.test.ts`
Expected: FAIL — `Cannot find module '../skin-type'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/skin-type.ts
// Maps the cosmetic scores to one of the four approved skin-type feels (deterministic, v1).
import type { ScoreVector, SkinTypeFeel } from '../read-types';

export function classify(scores: ScoreVector): SkinTypeFeel {
  if (scores.redness >= 0.6) return 'sensitive';
  if (scores.oiliness >= 0.6) return 'oily';
  if (scores.hydration <= 0.35) return 'dry';
  return 'combination';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/skin-type.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/skin-type.ts src/features/read/cv/__tests__/skin-type.test.ts
git commit -m "feat(read): skin-type classifier"
```

---

### Task 17: Scoring orchestrator (pure core)

**Files:**
- Create: `src/features/read/cv/score-from-rgb.ts`
- Test: `src/features/read/cv/__tests__/score-from-rgb.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Rect` (Task 1); `deriveRegions` (Task 6); `sampleBaseline` (Task 7); all 8 extractors (Tasks 8–15); `classify` (Task 16); `ReadResult`, `ScoreVector` (`read-types.ts`); `DIMENSIONS`, `SKIN_TYPE_FEELS` (`src/content/cosmetic-vocab.ts`).
- Produces: `CV_MODEL_VERSION = 'cv-1'`; `scoreFromRgb(rgb: RgbImage, bbox: Rect): ReadResult`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/score-from-rgb.test.ts
import { scoreFromRgb, CV_MODEL_VERSION } from '../score-from-rgb';
import { solidRgb, fillRect, addNoise } from '../fixtures';
import { deriveRegions } from '../regions';
import { DIMENSIONS, SKIN_TYPE_FEELS } from '../../../../content/cosmetic-vocab';

const SIZE = { width: 120, height: 120 };
const BBOX = { x: 0, y: 0, w: 120, h: 120 };

function composed() {
  const regions = deriveRegions(BBOX, SIZE);
  let img = solidRgb(120, 120, [180, 140, 120]);
  img = fillRect(img, regions.tZone, [215, 120, 105]); // some redness + shine
  img = addNoise(img, regions.forehead, 25, 4); // texture
  return img;
}

test('produces an in-range score for every dimension', () => {
  const result = scoreFromRgb(composed(), BBOX);
  expect(Object.keys(result.scores).sort()).toEqual([...DIMENSIONS].sort());
  for (const d of DIMENSIONS) {
    expect(result.scores[d]).toBeGreaterThanOrEqual(0);
    expect(result.scores[d]).toBeLessThanOrEqual(1);
  }
});

test('marks the read as a real CV read', () => {
  const result = scoreFromRgb(composed(), BBOX);
  expect(result.isStub).toBe(false);
  expect(result.modelVersion).toBe(CV_MODEL_VERSION);
  expect(result.modelVersion).toBe('cv-1');
  expect(SKIN_TYPE_FEELS).toContain(result.skinType);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/cv/__tests__/score-from-rgb.test.ts`
Expected: FAIL — `Cannot find module '../score-from-rgb'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/cv/score-from-rgb.ts
// Pure scoring core: decoded RGB + face bbox → cosmetic ScoreVector + skin type. Host-tested.
// The device wrapper (cv-read-engine.ts) supplies (rgb, bbox); this file never touches native.
import type { RgbImage, Rect } from './types';
import type { ReadResult, ScoreVector } from '../read-types';
import { deriveRegions } from './regions';
import { sampleBaseline } from './baseline';
import { redness } from './dimensions/redness';
import { darkCircles } from './dimensions/darkCircles';
import { oiliness } from './dimensions/oiliness';
import { texture } from './dimensions/texture';
import { pores } from './dimensions/pores';
import { fineLines } from './dimensions/fineLines';
import { darkSpots } from './dimensions/darkSpots';
import { hydration } from './dimensions/hydration';
import { classify } from './skin-type';

export const CV_MODEL_VERSION = 'cv-1';

export function scoreFromRgb(rgb: RgbImage, bbox: Rect): ReadResult {
  const regions = deriveRegions(bbox, { width: rgb.width, height: rgb.height });
  const baseline = sampleBaseline(rgb, regions);
  const scores: ScoreVector = {
    hydration: hydration(rgb, regions),
    oiliness: oiliness(rgb, regions),
    texture: texture(rgb, regions),
    pores: pores(rgb, regions),
    darkSpots: darkSpots(rgb, regions, baseline),
    redness: redness(rgb, regions, baseline),
    fineLines: fineLines(rgb, regions),
    darkCircles: darkCircles(rgb, regions, baseline),
  };
  return { scores, skinType: classify(scores), modelVersion: CV_MODEL_VERSION, isStub: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/cv/__tests__/score-from-rgb.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/cv/score-from-rgb.ts src/features/read/cv/__tests__/score-from-rgb.test.ts
git commit -m "feat(read): pure CV scoring orchestrator"
```

---

### Task 18: Fairness self-test (CV extractor)

**Files:**
- Create: `eval/fairness/self-test-images.ts`
- Create: `eval/fairness/cv-extractor.ts`
- Test: `eval/fairness/__tests__/cv-self-test.test.ts`

**Interfaces:**
- Consumes: `scoreFromRgb` (Task 17); `solidRgb`, `fillRect` (Task 2); `Extractor` (`eval/fairness/run-eval.ts`), `runEval`; `fairnessReport` (`eval/fairness/metrics.ts`); `ManifestEntry` (`eval/fairness/manifest.ts`); `FITZPATRICK` (`eval/fairness/fst.ts`); `QualityReport` (`src/features/capture/quality-gate.ts`).
- Produces: `renderSelfTestFace(fst: ManifestEntry['fst']): { rgb: RgbImage; bbox: Rect }` (identical skin "issues", only baseline tone differs by FST); `cvSelfTestExtractor: Extractor`; `buildSelfTestManifest(subjectsPerFst: number): ManifestEntry[]`.

**Notes:** The whole point is tone-invariance — the *same* synthetic blemishes rendered on six skin tones must yield the same scores, driving `bias.ts` correlation to ~0. A passing `QualityReport` is attached so gate-parity/stability also evaluate to PASS.

- [ ] **Step 1: Write the failing test**

```ts
// eval/fairness/__tests__/cv-self-test.test.ts
import { buildSelfTestManifest, cvSelfTestExtractor } from '../cv-extractor';
import { runEval } from '../run-eval';
import { fairnessReport } from '../metrics';

test('CV scores are tone-invariant: fairness report passes on the self-test set', async () => {
  const manifest = buildSelfTestManifest(30); // 30 subjects/FST, 2 captures each
  const observations = await runEval(manifest, cvSelfTestExtractor);
  const report = fairnessReport(observations, '2026-06-22T00:00:00.000Z');

  expect(report.bias.pass).toBe(true);
  expect(report.pass).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- eval/fairness/__tests__/cv-self-test.test.ts`
Expected: FAIL — `Cannot find module '../cv-extractor'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// eval/fairness/self-test-images.ts
// Synthetic faces for the fairness self-test. The SAME blemishes are painted on every tone;
// only the baseline skin colour changes per Fitzpatrick group. If the CV read is tone-fair,
// the scores must be (near) identical across groups — that is what the bias axis checks.
import { solidRgb, fillRect } from '../../src/features/read/cv/fixtures';
import { deriveRegions } from '../../src/features/read/cv/regions';
import type { RgbImage, Rect } from '../../src/features/read/cv/types';
import type { ManifestEntry } from './manifest';

const SIZE = { width: 120, height: 120 };
const BBOX: Rect = { x: 0, y: 0, w: 120, h: 120 };

// Representative sRGB skin tones for Fitzpatrick I..VI (light → deep), descending luminance.
const TONE: Record<ManifestEntry['fst'], [number, number, number]> = {
  I: [235, 205, 188],
  II: [222, 188, 165],
  III: [198, 158, 130],
  IV: [165, 122, 95],
  V: [120, 84, 64],
  VI: [82, 57, 44],
};

export function renderSelfTestFace(fst: ManifestEntry['fst']): { rgb: RgbImage; bbox: Rect } {
  const regions = deriveRegions(BBOX, SIZE);
  let rgb = solidRgb(120, 120, TONE[fst]);
  // Identical relative "issues" on every tone: a darker T-zone patch and a forehead spot,
  // each a fixed luminance drop below the tone so the deltas (not absolutes) match across tones.
  const [r, g, b] = TONE[fst];
  rgb = fillRect(rgb, regions.tZone, [r - 30, g - 20, b - 16]);
  rgb = fillRect(rgb, { x: regions.forehead.x + 2, y: regions.forehead.y + 2, w: 6, h: 6 }, [r - 35, g - 24, b - 18]);
  return { rgb, bbox: BBOX };
}
```

```ts
// eval/fairness/cv-extractor.ts
// Wires the pure CV read into the fairness harness over the synthetic self-test set — no
// device, no real faces. Real consented images are the separate, legally-gated sub-project D.
import { scoreFromRgb } from '../../src/features/read/cv/score-from-rgb';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { Extractor } from './run-eval';
import type { ManifestEntry } from './manifest';
import { FITZPATRICK } from './fst';
import { renderSelfTestFace } from './self-test-images';

const PASS_GATE: QualityReport = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };

export const cvSelfTestExtractor: Extractor = async (entry) => {
  const { rgb, bbox } = renderSelfTestFace(entry.fst);
  return { gate: PASS_GATE, scores: scoreFromRgb(rgb, bbox).scores };
};

export function buildSelfTestManifest(subjectsPerFst: number): ManifestEntry[] {
  const out: ManifestEntry[] = [];
  for (const fst of FITZPATRICK) {
    for (let s = 0; s < subjectsPerFst; s++) {
      const subjectId = `${fst}-${s}`;
      // two captures per subject so the stability axis is evaluable
      for (let c = 0; c < 2; c++) {
        out.push({
          imageRef: `self-test:${subjectId}:${c}`,
          fst,
          subjectId,
          lighting: 'synthetic',
          source: 'self-test',
          consentRef: 'self-test:no-real-subject',
          fstProvenance: 'annotated',
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- eval/fairness/__tests__/cv-self-test.test.ts`
Expected: PASS (1 test). If `report.bias.pass` is false, the tone-relative deltas are leaking — verify each extractor subtracts the baseline (Tasks 7–15), then re-run. Do not loosen `thresholds.ts`.

- [ ] **Step 5: Commit**

```bash
git add eval/fairness/self-test-images.ts eval/fairness/cv-extractor.ts eval/fairness/__tests__/cv-self-test.test.ts
git commit -m "test(fairness): tone-invariance self-test for the CV read"
```

---

### Task 19: Device wrapper + decode/detect shells

**Files:**
- Create: `src/features/read/decode-rgb.ts`
- Create: `src/features/read/detect-bbox.ts`
- Create: `src/features/read/cv-read-engine.ts`
- Test: `src/features/read/__tests__/cv-read-engine.test.ts`

**Interfaces:**
- Consumes: `RgbImage`, `Rect` (Task 1); `scoreFromRgb` (Task 17); `withImageCleanup` (`src/features/read/image-lifecycle.ts`); `ReadEngine` (`read-engine.ts`), `ReadResult` (`read-types.ts`).
- Produces: device-only `decodeJpegToRgb(uri: string): Promise<RgbImage>`; device-only `detectFaceBbox(uri: string): Promise<Rect>`; `class CvReadEngine implements ReadEngine` with constructor `new CvReadEngine(deps?: { decode?; detect?; del? })` (defaults to the device fns + `expo-file-system` delete) and `run(uri): Promise<ReadResult>`.

**Notes:** The wrapper logic (delegate to `scoreFromRgb`, always delete the image) is host-tested by injecting fake `decode`/`detect`/`del`. The two native fns mirror the existing `executorch-engine.ts` device-only pattern: they throw on the host so they can never be silently used off-device, and carry the documented intended native call.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/__tests__/cv-read-engine.test.ts
import { CvReadEngine } from '../cv-read-engine';
import { solidRgb } from '../cv/fixtures';

test('decodes, scores, and deletes the image (success path)', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => solidRgb(120, 120, [180, 140, 120]),
    detect: async () => ({ x: 0, y: 0, w: 120, h: 120 }),
    del: async (uri: string) => {
      deleted.push(uri);
    },
  });

  const result = await engine.run('file:///tmp/face.jpg');

  expect(result.isStub).toBe(false);
  expect(result.modelVersion).toBe('cv-1');
  expect(deleted).toEqual(['file:///tmp/face.jpg']);
});

test('deletes the image even when scoring throws', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => {
      throw new Error('decode boom');
    },
    detect: async () => ({ x: 0, y: 0, w: 1, h: 1 }),
    del: async (uri: string) => {
      deleted.push(uri);
    },
  });

  await expect(engine.run('file:///tmp/face.jpg')).rejects.toThrow('decode boom');
  expect(deleted).toEqual(['file:///tmp/face.jpg']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/__tests__/cv-read-engine.test.ts`
Expected: FAIL — `Cannot find module '../cv-read-engine'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/decode-rgb.ts
// DEVICE-ONLY: verify on a physical Android phone via an Expo dev build. Decodes the captured
// JPEG to a fixed working-size RGBA RgbImage (512px longest edge). Intended native path:
// expo-image-manipulator resize → read pixels (confirm exact pixel-access API on-device via
// Context7 before wiring). Throws on the host so it can never be used off-device by accident.
import type { RgbImage } from './cv/types';

export const WORKING_EDGE = 512;

export async function decodeJpegToRgb(_uri: string): Promise<RgbImage> {
  // DEVICE-ONLY: replace with the confirmed native decode+resize call.
  throw new Error(
    'decodeJpegToRgb is a device-only stub: implement against the confirmed native JPEG decode/resize API',
  );
}
```

```ts
// src/features/read/detect-bbox.ts
// DEVICE-ONLY: verify on a physical Android phone. Runs the vision-camera face detector on the
// STILL image (the capture-time bbox came from a lower-res preview frame) and returns the face
// bounding box in pixel coordinates of the decoded RgbImage. Throws on the host by design.
import type { Rect } from './cv/types';

export async function detectFaceBbox(_uri: string): Promise<Rect> {
  // DEVICE-ONLY: replace with the confirmed native face-detector call.
  throw new Error(
    'detectFaceBbox is a device-only stub: implement against the confirmed native face detector',
  );
}
```

```ts
// src/features/read/cv-read-engine.ts
// Thin device wrapper that keeps the unchanged ReadEngine interface. The only device-only work
// (decode + still-image bbox detection) lives behind injectable deps; everything else is the
// pure, host-tested scoreFromRgb core. The raw image is always deleted via withImageCleanup —
// it never crosses the compliance boundary (CLAUDE.md §1, §3).
import * as FileSystem from 'expo-file-system';
import type { Rect } from './cv/types';
import type { RgbImage } from './cv/types';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { withImageCleanup } from './image-lifecycle';
import { scoreFromRgb } from './cv/score-from-rgb';
import { decodeJpegToRgb } from './decode-rgb';
import { detectFaceBbox } from './detect-bbox';

interface Deps {
  decode?: (uri: string) => Promise<RgbImage>;
  detect?: (uri: string) => Promise<Rect>;
  del?: (uri: string) => Promise<void>;
}

export class CvReadEngine implements ReadEngine {
  private readonly decode: (uri: string) => Promise<RgbImage>;
  private readonly detect: (uri: string) => Promise<Rect>;
  private readonly del: (uri: string) => Promise<void>;

  constructor(deps: Deps = {}) {
    this.decode = deps.decode ?? decodeJpegToRgb;
    this.detect = deps.detect ?? detectFaceBbox;
    this.del = deps.del ?? ((uri: string) => FileSystem.deleteAsync(uri, { idempotent: true }));
  }

  async run(uri: string): Promise<ReadResult> {
    return withImageCleanup(
      uri,
      async (u) => {
        const rgb = await this.decode(u); // DEVICE-ONLY
        const bbox = await this.detect(u); // DEVICE-ONLY
        return scoreFromRgb(rgb, bbox); // pure, tested
      },
      this.del,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/__tests__/cv-read-engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/read/decode-rgb.ts src/features/read/detect-bbox.ts src/features/read/cv-read-engine.ts src/features/read/__tests__/cv-read-engine.test.ts
git commit -m "feat(read): CvReadEngine device wrapper + decode/detect shells"
```

---

### Task 20: Wire the capture flow + frame processors + device verification

**Files:**
- Create: `src/features/read/run-read.ts`
- Test: `src/features/read/__tests__/run-read.test.ts`
- Modify: `app/scan/index.tsx` (call `runRead` instead of `runStubRead`)
- Modify: `src/features/capture/use-frame-metrics.ts:57` (`FRAME_PROCESSORS_INSTALLED = true`)

**Interfaces:**
- Consumes: `CvReadEngine` (Task 19); `recordScan` (`src/lib/scans.ts`); `stubRead` (`src/features/read/stub-read.ts`, dev fallback only); `ReadEngine` (`read-engine.ts`).
- Produces: `runRead(photoUri: string, deps?: { engine?: ReadEngine; persist?: (r: ReadResult) => Promise<void> }): Promise<void>`.

**Notes:** `runRead` mirrors `run-stub-read.ts` but drives the real engine. Because `decodeJpegToRgb` throws on the host (and on web/Expo Go preview, which has no native decode), `runRead` falls back to `stubRead()` **only** when `__DEV__` is true and the real read throws — so the web preview keeps working while real devices always get the real read. The image deletion already happened inside `CvReadEngine.run` (via `withImageCleanup`) before any throw escapes, so the fallback never touches the image.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/__tests__/run-read.test.ts
import { runRead } from '../run-read';
import type { ReadEngine } from '../read-engine';
import type { ReadResult } from '../read-types';

const fakeResult: ReadResult = {
  scores: {
    hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
    darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
  },
  skinType: 'combination',
  modelVersion: 'cv-1',
  isStub: false,
};

test('persists the real engine result', async () => {
  const persisted: ReadResult[] = [];
  const engine: ReadEngine = { run: async () => fakeResult };
  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });
  expect(persisted).toEqual([fakeResult]);
});

test('propagates engine failure (no silent swallow outside dev fallback)', async () => {
  const engine: ReadEngine = { run: async () => { throw new Error('read failed'); } };
  // __DEV__ is true under jest-expo, so the dev fallback persists a stub instead of throwing.
  const persisted: ReadResult[] = [];
  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });
  expect(persisted).toHaveLength(1);
  expect(persisted[0].isStub).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/read/__tests__/run-read.test.ts`
Expected: FAIL — `Cannot find module '../run-read'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/read/run-read.ts
// Capture-flow entry for the REAL read: run the CV engine on-device (which deletes the image),
// then persist only derived scores (CLAUDE.md §3). In __DEV__ (web/Expo Go preview, where the
// native decode is unavailable) it falls back to the stub so the non-device preview still works.
import { recordScan } from '../../lib/scans';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { CvReadEngine } from './cv-read-engine';
import { stubRead } from './stub-read';

interface Deps {
  engine?: ReadEngine;
  persist?: (r: ReadResult) => Promise<void>;
}

export async function runRead(photoUri: string, deps: Deps = {}): Promise<void> {
  const engine = deps.engine ?? new CvReadEngine();
  const persist = deps.persist ?? recordScan;
  try {
    const result = await engine.run(photoUri);
    await persist(result);
  } catch (err) {
    if (__DEV__) {
      // Preview-only fallback: the device decode is unavailable off-device. Never reached on a
      // real Android dev build, where engine.run() returns a real cv-1 result.
      await persist(stubRead());
      return;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/read/__tests__/run-read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the route and flip frame processors**

Edit `app/scan/index.tsx` — replace the `runStubRead` import and call with `runRead`:

```tsx
import { runRead } from '../../src/features/read/run-read';
// ...inside onCaptured:
await runRead(photoUri);
```

Edit `src/features/capture/use-frame-metrics.ts:57`:

```ts
const FRAME_PROCESSORS_INSTALLED = true;
```

- [ ] **Step 6: Run the full host suite + compliance gates**

```bash
npm test
npm run check:compliance
npm run check:no-egress
```

Expected: all green. `npm test` includes every new CV suite + the fairness self-test; the two compliance scripts confirm no image egress and no analytics SDK crept in.

- [ ] **Step 7: Commit the wiring**

```bash
git add src/features/read/run-read.ts src/features/read/__tests__/run-read.test.ts app/scan/index.tsx src/features/capture/use-frame-metrics.ts
git commit -m "feat(read): drive capture flow with the real CV engine + enable frame processors"
```

- [ ] **Step 8: On-device verification (manual, physical Android phone — the one non-host step)**

This is the milestone's definition-of-done gate. It cannot run in CI.

1. Build a fresh dev client (also fixes the stale-build AsyncStorage crash):
   ```bash
   eas build --profile development --platform android
   ```
2. Install the resulting APK on the phone; open it via the dev-client app (not Expo Go); point it at Metro (`npx expo start --dev-client`).
3. Implement the two device-only shells against the confirmed native APIs (verify each via Context7 first):
   - `decode-rgb.ts` → `decodeJpegToRgb` (expo-image-manipulator resize → pixel buffer).
   - `detect-bbox.ts` → `detectFaceBbox` (vision-camera face detector on the still).
4. Run the full flow on the phone: age gate → consent → capture (quality gate now driven by **real** frame processors) → real CV read → result screen shows **varied, non-stub** scores → routine → chat.
5. Confirm: the persisted scan has `isStub: false` and `modelVersion: 'cv-1'`; the captured image file is gone after the read.
6. Re-run `npm run check:no-egress` and `npm run check:compliance` after any native wiring.

- [ ] **Step 9: Commit the device wiring** (after the on-device pass)

```bash
git add src/features/read/decode-rgb.ts src/features/read/detect-bbox.ts
git commit -m "feat(read): native JPEG decode + still-image face detection (device-verified)"
```

---

## Definition of Done (milestone)

- [ ] Real CV scores from a real captured photo, end-to-end on a physical Android phone.
- [ ] All host tests + the fairness self-test green (`npm test`); `check:compliance` + `check:no-egress` green.
- [ ] Persisted scans carry `isStub: false`, `modelVersion: 'cv-1'`; the `.pte`/executorch shell is untouched (dormant for v2).
- [ ] No public accuracy/efficacy/skin-tone-equity claim shipped (deferred to sub-project D).
- [ ] Cosmetic schema unchanged; output still passes the cosmetic post-filter; 18+ gate + logged consent + RLS + encryption all intact.
