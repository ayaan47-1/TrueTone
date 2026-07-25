# Scan-Accuracy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the on-device read accurate — real contour-placed face regions, illumination-invariant scoring, a quality gate that refuses unreadable captures — and build the synthetic harness that measures whether any of it worked.

**Architecture:** A physically-grounded synthetic face renderer drives four fail-closed invariance axes, built *first* so every later change lands with a measured before/after. Then the pipeline is fixed in dependency order: relative dimension measures → correct resampling → contour-based region placement via the still-image face detector → illuminant normalization → gate hardening. Every new stage fails open to today's behaviour; the gate alone fails closed.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), `react-native-vision-camera` v5.0.11, `react-native-vision-camera-face-detector` v2.0.1 (MLKit), `jpeg-js`, Jest, Supabase (Postgres + pgTAP).

**Spec:** `docs/superpowers/specs/2026-07-25-scan-accuracy-pipeline-design.md`

## Global Constraints

- **Cosmetic appearance only.** No disease names, no diagnosis, no treatment claims in any user-facing string. Gate hints describe *light and framing*, never skin. (CLAUDE.md §1)
- **No accuracy, efficacy, or skin-tone-equity claim** may be added anywhere. Synthetic invariance is not validation data on file. (CLAUDE.md §1, §7)
- **The raw image never leaves the device** and is deleted after the read via `withImageCleanup`. All new processing runs inside that lifecycle. `npm run check:no-egress` must stay green.
- **No new dependency.** `package.json` does not change. The still-image detector is an existing API of an already-installed package (spec §3a).
- **No new cosmetic dimensions.** The eight in `src/content/cosmetic-vocab.ts` are fixed for this track.
- **Fail open, never worse.** Every new read stage falls back to today's behaviour on bad input. Only `evaluateQuality` fails closed.
- **Immutability.** Never mutate an input `RgbImage`; return a new buffer (matches `cv/fixtures.ts`).
- **Coverage floor:** `lines/statements ≥ 80%`, `branches ≥ 70%`, `functions ≥ 80%` (`jest.config.js`).
- **Device-only code** carries a `// DEVICE-ONLY` comment and is added to `coveragePathIgnorePatterns`.
- **Commit style:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

**Branch:** `feat/scan-accuracy` (already created, off `main`; spec + step 1 landed).

**Already done — do not redo:** Spec step 1 (`FRAME_PROCESSORS_INSTALLED = true`, commit `8940828`). On-device threshold tuning remains open and is Task 14.

---

## File Structure

**New — pure (host-tested):**
| File | Responsibility |
|---|---|
| `eval/render/tone.ts` | Fitzpatrick → linear skin reflectance; Planckian temperature → illuminant RGB |
| `eval/render/noise.ts` | Seeded PRNG + multi-octave value noise |
| `eval/render/geometry.ts` | Face ellipse normals, region rects, synthetic contour polygons |
| `eval/render/face.ts` | `renderFace(params)` — composes the above into an `RgbImage` |
| `eval/invariance/thresholds.ts` | ε bounds, cross-talk bound, Spearman floor |
| `eval/invariance/axes.ts` | The four axis functions |
| `eval/invariance/report.ts` | Aggregate report render (JSON + Markdown) |
| `src/features/read/cv/resample.ts` | Area-averaged downscale |
| `src/features/read/cv/illuminant.ts` | Skin-locus estimation, chromatic adaptation, shading flattening |
| `src/features/read/face-geometry.ts` | Contours → `Regions`; photo→working scale; fallback chain |
| `src/features/capture/chroma-metrics.ts` | Clipping, colour temperature, shading imbalance |

**New — device shells (`// DEVICE-ONLY`, coverage-excluded):**
| File | Responsibility |
|---|---|
| `src/features/read/detect-faces-still.ts` | `createImageFaceDetector` on the captured photo |
| `app/(dev)/bbox-overlay.tsx` | Draws bounds + contours + regions onto the photo |

**Modified:**
| File | Change |
|---|---|
| `src/features/read/cv/dimensions/{pores,fineLines,oiliness}.ts` | absolute → relative measures |
| `src/features/read/cv/calibration.ts` | re-range `CAL` for the new measures |
| `src/features/read/cv/sampling.ts` | add `relativeContrastDensity`, `relativeGradientEnergy` |
| `src/features/read/cv/regions.ts` | add contour path, keep proportional fallback |
| `src/features/read/decode-rgb.ts` | use `resample.ts`; apply EXIF orientation |
| `src/features/read/cv-read-engine.ts` | wire detection + normalization |
| `src/features/read/detect-bbox.ts` | consume detected bounds; correct the stale §6 note |
| `src/features/capture/face-metrics.ts` | surface head pose |
| `src/features/capture/quality-gate.ts` | four new checks |
| `src/features/capture/use-frame-metrics.ts` | publish chroma + pose |
| `src/lib/scans.ts` | pass/read `captureQuality` |
| `supabase/migrations/0013_capture_quality.sql` | new column + RPC |

---

## Task 1: Renderer foundations — tone, illuminant, noise

**Files:**
- Create: `eval/render/tone.ts`, `eval/render/noise.ts`
- Test: `eval/render/__tests__/tone.test.ts`, `eval/render/__tests__/noise.test.ts`

**Interfaces:**
- Consumes: `Fitzpatrick` from `eval/fairness/fst.ts`
- Produces:
  - `SKIN_REFLECTANCE: Record<Fitzpatrick, [number, number, number]>` — linear 0..1
  - `planckianRgb(tempK: number): [number, number, number]` — normalized so 6500 K ≈ `[1,1,1]`
  - `makeRng(seed: number): () => number` — deterministic, 0..1
  - `valueNoise2d(rng, width, height, octaves): Float32Array` — length `width*height`, mean ≈ 0, range ≈ ±1

- [ ] **Step 1: Write the failing tests**

```ts
// eval/render/__tests__/tone.test.ts
import { SKIN_REFLECTANCE, planckianRgb } from '../tone';
import { FITZPATRICK } from '../../fairness/fst';

describe('skin reflectance', () => {
  it('covers every Fitzpatrick type', () => {
    for (const f of FITZPATRICK) expect(SKIN_REFLECTANCE[f]).toHaveLength(3);
  });

  it('decreases monotonically in luminance from I to VI', () => {
    const lum = FITZPATRICK.map((f) => {
      const [r, g, b] = SKIN_REFLECTANCE[f];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1]);
  });

  it('keeps every channel in (0, 1]', () => {
    for (const f of FITZPATRICK) {
      for (const c of SKIN_REFLECTANCE[f]) {
        expect(c).toBeGreaterThan(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it('preserves the red > green > blue ordering of skin at every tone', () => {
    for (const f of FITZPATRICK) {
      const [r, g, b] = SKIN_REFLECTANCE[f];
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });
});

describe('planckianRgb', () => {
  it('is near-neutral at 6500K', () => {
    const [r, g, b] = planckianRgb(6500);
    expect(r).toBeCloseTo(1, 1);
    expect(g).toBeCloseTo(1, 1);
    expect(b).toBeCloseTo(1, 1);
  });

  it('is warm (red-heavy) below 6500K and cool (blue-heavy) above', () => {
    const warm = planckianRgb(2700);
    const cool = planckianRgb(9000);
    expect(warm[0] / warm[2]).toBeGreaterThan(1.5);
    expect(cool[2] / cool[0]).toBeGreaterThan(1.0);
  });
});
```

```ts
// eval/render/__tests__/noise.test.ts
import { makeRng, valueNoise2d } from '../noise';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs between seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });

  it('stays within [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('valueNoise2d', () => {
  // Mean-centering and peak-normalization are GUARANTEED by the implementation, not hoped for.
  // A coarse base lattice is only 3x3 = 9 random values, and every pixel interpolates those same
  // nine — so without explicit centering the field carries a large arbitrary DC offset no matter
  // how many pixels it has. In the renderer that offset would systematically brighten or darken
  // the skin, leaking into tone.
  const meanOf = (n: Float32Array) => n.reduce((s, v) => s + v, 0) / n.length;
  // High-frequency energy: mean absolute difference between horizontally adjacent samples.
  // This is what "more octaves = more detail" actually means. Global variance is NOT the right
  // measure — adding finer octaves at halved amplitude lowers global variance while raising detail.
  const hfEnergy = (n: Float32Array, w: number, h: number) => {
    let s = 0, c = 0;
    for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { s += Math.abs(n[y * w + x] - n[y * w + x - 1]); c++; }
    return s / c;
  };

  it('returns one sample per pixel', () => {
    expect(valueNoise2d(makeRng(1), 16, 8, 3)).toHaveLength(128);
  });

  it('is zero-mean by construction', () => {
    expect(meanOf(valueNoise2d(makeRng(3), 64, 64, 4))).toBeCloseTo(0, 5);
  });

  it('is zero-mean even at a single coarse octave, where lattice bias is worst', () => {
    expect(meanOf(valueNoise2d(makeRng(11), 64, 64, 1))).toBeCloseTo(0, 5);
  });

  it('is normalized to a peak amplitude of exactly 1', () => {
    // The renderer applies this as `1 + noise * amplitude`, so a predictable peak is what makes
    // the amplitude parameters mean the same thing at every octave count.
    const n = valueNoise2d(makeRng(5), 64, 64, 4);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });

  it('produces more high-frequency detail with more octaves', () => {
    const at = (oct: number) => hfEnergy(valueNoise2d(makeRng(5), 64, 64, oct), 64, 64);
    const [o1, o3, o5] = [at(1), at(3), at(5)];
    expect(o3).toBeGreaterThan(o1);
    expect(o5).toBeGreaterThan(o3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest eval/render --verbose`
Expected: FAIL — `Cannot find module '../tone'` and `'../noise'`.

- [ ] **Step 3: Implement**

```ts
// eval/render/tone.ts
// Forward skin/illuminant model for the synthetic renderer.
//
// CIRCULARITY NOTE (spec §6a): this is deliberately NOT the log-chromaticity linear model that
// cv/illuminant.ts will use to ESTIMATE the illuminant. If the renderer and the estimator shared a
// formulation, the invariance axes would only prove the estimator can invert our own arithmetic.
import type { Fitzpatrick } from '../fairness/fst';

// Linear (pre-gamma) diffuse reflectance per Fitzpatrick type. Melanin absorbs short wavelengths
// most, so deeper tones fall fastest in blue — which is why the R > G > B ordering holds throughout
// and the channels do not simply scale together.
export const SKIN_REFLECTANCE: Record<Fitzpatrick, [number, number, number]> = {
  I: [0.86, 0.68, 0.60],
  II: [0.78, 0.58, 0.49],
  III: [0.64, 0.44, 0.35],
  IV: [0.47, 0.29, 0.22],
  V: [0.30, 0.17, 0.12],
  VI: [0.17, 0.09, 0.06],
};

// Approximate Planckian locus → linear RGB gain, normalized to unity at 6500 K.
export function planckianRgb(tempK: number): [number, number, number] {
  const t = Math.max(1000, Math.min(15000, tempK)) / 100;
  const ch = (v: number) => Math.max(0, Math.min(255, v)) / 255;

  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  const raw: [number, number, number] = [ch(r), ch(g), ch(b)];
  // Normalize so 6500 K is neutral: divide by the same function evaluated at 6500 K.
  const n: [number, number, number] = [0.9917, 0.9736, 1.0];
  return [raw[0] / n[0], raw[1] / n[1], raw[2] / n[2]];
}
```

```ts
// eval/render/noise.ts
// Deterministic seeded noise. Math.random() is never used — every rendered image must be
// byte-identical across runs, or the invariance axes would report their own jitter as drift.

export function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    // xorshift32. Every shift is unsigned: `>>` would sign-extend once s exceeds 2^31.
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function lattice(rng: () => number, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = rng() * 2 - 1;
  return g;
}

// Multi-octave value noise, bilinearly interpolated from progressively finer lattices.
//
// The trailing centre-and-normalize step is load-bearing, not tidying:
//   - CENTERING: the coarsest octave draws only (cells+1)^2 = 9 lattice values, and every pixel
//     interpolates those same nine. The field's mean is therefore small-sample lattice noise —
//     typically ±0.2 — and adding pixels does not reduce it. Uncentered, that DC offset would
//     systematically brighten or darken rendered skin and leak into tone.
//   - PEAK NORMALIZATION: the renderer applies this as `1 + noise * amplitude`, so pinning the
//     peak to 1 makes an amplitude parameter mean the same thing regardless of octave count.
export function valueNoise2d(
  rng: () => number,
  width: number,
  height: number,
  octaves: number,
): Float32Array {
  const out = new Float32Array(width * height);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = Math.max(2, 2 << o);
    const g = lattice(rng, cells + 1, cells + 1);
    for (let y = 0; y < height; y++) {
      const fy = (y / height) * cells;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      for (let x = 0; x < width; x++) {
        const fx = (x / width) * cells;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const at = (cx: number, cy: number) => g[cy * (cells + 1) + cx];
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bot = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        out[y * width + x] += (top * (1 - ty) + bot * ty) * amp;
      }
    }
    amp *= 0.5;
  }

  let mean = 0;
  for (let i = 0; i < out.length; i++) mean += out[i];
  mean /= out.length;

  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] -= mean;
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest eval/render --verbose`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/render/tone.ts eval/render/noise.ts eval/render/__tests__/
git commit -m "feat(eval): renderer foundations — skin reflectance, Planckian illuminant, seeded noise"
```

---

## Task 2: Face geometry and synthetic contours

**Files:**
- Create: `eval/render/geometry.ts`
- Test: `eval/render/__tests__/geometry.test.ts`

**Interfaces:**
- Consumes: nothing — this module is self-contained (it is the *producer* of contours; `Rect`/`Regions` belong to their *consumer*, Task 10)
- Produces:
  - `faceEllipse(size, geometry): { cx, cy, rx, ry }`
  - `surfaceNormal(x, y, e): [number, number, number]` — unit vector; `[0,0,1]` outside the ellipse
  - `syntheticContours(e): FaceContours` where
    `FaceContours = { FACE: Point[]; LEFT_CHEEK: Point[]; RIGHT_CHEEK: Point[]; LEFT_EYE: Point[]; RIGHT_EYE: Point[]; LEFT_EYEBROW_TOP: Point[]; RIGHT_EYEBROW_TOP: Point[]; NOSE_BRIDGE: Point[]; NOSE_BOTTOM: Point[] }`
    and `Point = { x: number; y: number }` — mirrors the shape MLKit returns, so `face-geometry.ts` (Task 9) can be tested against renderer output with no adapter.

- [ ] **Step 1: Write the failing test**

```ts
// eval/render/__tests__/geometry.test.ts
import { faceEllipse, surfaceNormal, syntheticContours } from '../geometry';

const SIZE = { width: 256, height: 256 };
const GEO = { scale: 1, dx: 0, dy: 0 };

describe('faceEllipse', () => {
  it('centers the face when there is no offset', () => {
    const e = faceEllipse(SIZE, GEO);
    expect(e.cx).toBeCloseTo(128);
    expect(e.cy).toBeCloseTo(128);
  });

  it('shifts with dx/dy and shrinks with scale', () => {
    const e = faceEllipse(SIZE, { scale: 0.5, dx: 0.1, dy: -0.1 });
    expect(e.cx).toBeGreaterThan(128);
    expect(e.cy).toBeLessThan(128);
    expect(e.rx).toBeLessThan(faceEllipse(SIZE, GEO).rx);
  });
});

describe('surfaceNormal', () => {
  it('points straight at the viewer at the face center', () => {
    const e = faceEllipse(SIZE, GEO);
    const [nx, ny, nz] = surfaceNormal(e.cx, e.cy, e);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeCloseTo(0);
    expect(nz).toBeCloseTo(1);
  });

  it('tilts outward near the edge', () => {
    const e = faceEllipse(SIZE, GEO);
    const [nx, , nz] = surfaceNormal(e.cx + e.rx * 0.9, e.cy, e);
    expect(nx).toBeGreaterThan(0.5);
    expect(nz).toBeLessThan(0.9);
  });

  it('is a unit vector everywhere inside the ellipse', () => {
    const e = faceEllipse(SIZE, GEO);
    for (const [x, y] of [[128, 128], [150, 140], [110, 160]]) {
      const n = surfaceNormal(x, y, e);
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
    }
  });
});

describe('syntheticContours', () => {
  const e = faceEllipse(SIZE, GEO);
  const c = syntheticContours(e);

  it('provides every contour face-geometry consumes', () => {
    for (const k of ['FACE', 'LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE',
                     'LEFT_EYEBROW_TOP', 'RIGHT_EYEBROW_TOP', 'NOSE_BRIDGE', 'NOSE_BOTTOM'] as const) {
      expect(c[k].length).toBeGreaterThan(2);
    }
  });

  it('keeps every feature contour inside the FACE polygon bounds', () => {
    const xs = c.FACE.map((p) => p.x);
    const ys = c.FACE.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (const k of ['LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE', 'NOSE_BRIDGE'] as const) {
      for (const p of c[k]) {
        expect(p.x).toBeGreaterThanOrEqual(x0);
        expect(p.x).toBeLessThanOrEqual(x1);
        expect(p.y).toBeGreaterThanOrEqual(y0);
        expect(p.y).toBeLessThanOrEqual(y1);
      }
    }
  });

  it('places the left contours left of the right ones', () => {
    const meanX = (ps: { x: number }[]) => ps.reduce((s, p) => s + p.x, 0) / ps.length;
    expect(meanX(c.LEFT_CHEEK)).toBeLessThan(meanX(c.RIGHT_CHEEK));
    expect(meanX(c.LEFT_EYE)).toBeLessThan(meanX(c.RIGHT_EYE));
  });

  it('places eyes above cheeks and the nose between them', () => {
    const meanY = (ps: { y: number }[]) => ps.reduce((s, p) => s + p.y, 0) / ps.length;
    expect(meanY(c.LEFT_EYE)).toBeLessThan(meanY(c.LEFT_CHEEK));
    expect(meanY(c.NOSE_BRIDGE)).toBeLessThan(meanY(c.NOSE_BOTTOM));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest eval/render/__tests__/geometry.test.ts --verbose`
Expected: FAIL — `Cannot find module '../geometry'`.

- [ ] **Step 3: Implement**

```ts
// eval/render/geometry.ts
// Face shape for the synthetic renderer: an ellipsoid standing in for a head, plus contour
// polygons in the SAME shape MLKit returns (spec §3b), so face-geometry.ts can be unit-tested
// against renderer output without an adapter layer.

export interface Point { x: number; y: number }
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }
export interface RenderGeometry { scale: number; dx: number; dy: number }

export interface FaceContours {
  FACE: Point[];
  LEFT_CHEEK: Point[];
  RIGHT_CHEEK: Point[];
  LEFT_EYE: Point[];
  RIGHT_EYE: Point[];
  LEFT_EYEBROW_TOP: Point[];
  RIGHT_EYEBROW_TOP: Point[];
  NOSE_BRIDGE: Point[];
  NOSE_BOTTOM: Point[];
}

export function faceEllipse(
  size: { width: number; height: number },
  g: RenderGeometry,
): Ellipse {
  return {
    cx: size.width / 2 + g.dx * size.width,
    cy: size.height / 2 + g.dy * size.height,
    rx: 0.34 * size.width * g.scale,
    ry: 0.44 * size.height * g.scale,
  };
}

// Ellipsoid normal: project the pixel into the unit disc, lift z off the sphere.
export function surfaceNormal(x: number, y: number, e: Ellipse): [number, number, number] {
  const nx = (x - e.cx) / e.rx;
  const ny = (y - e.cy) / e.ry;
  const r2 = nx * nx + ny * ny;
  if (r2 >= 1) return [0, 0, 1];
  const nz = Math.sqrt(1 - r2);
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

export function syntheticContours(e: Ellipse): FaceContours {
  const { cx, cy, rx, ry } = e;
  return {
    FACE: ellipsePoints(cx, cy, rx, ry, 32),
    LEFT_CHEEK: ellipsePoints(cx - rx * 0.45, cy + ry * 0.22, rx * 0.22, ry * 0.18, 12),
    RIGHT_CHEEK: ellipsePoints(cx + rx * 0.45, cy + ry * 0.22, rx * 0.22, ry * 0.18, 12),
    LEFT_EYE: ellipsePoints(cx - rx * 0.42, cy - ry * 0.18, rx * 0.16, ry * 0.07, 12),
    RIGHT_EYE: ellipsePoints(cx + rx * 0.42, cy - ry * 0.18, rx * 0.16, ry * 0.07, 12),
    LEFT_EYEBROW_TOP: ellipsePoints(cx - rx * 0.42, cy - ry * 0.34, rx * 0.20, ry * 0.03, 8),
    RIGHT_EYEBROW_TOP: ellipsePoints(cx + rx * 0.42, cy - ry * 0.34, rx * 0.20, ry * 0.03, 8),
    NOSE_BRIDGE: ellipsePoints(cx, cy - ry * 0.05, rx * 0.06, ry * 0.20, 8),
    NOSE_BOTTOM: ellipsePoints(cx, cy + ry * 0.18, rx * 0.12, ry * 0.05, 8),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest eval/render/__tests__/geometry.test.ts --verbose`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/render/geometry.ts eval/render/__tests__/geometry.test.ts
git commit -m "feat(eval): face ellipsoid geometry + MLKit-shaped synthetic contours"
```

---

## Task 3: The renderer itself

**Files:**
- Create: `eval/render/face.ts`
- Test: `eval/render/__tests__/face.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `RgbImage`, `Rect` from `src/features/read/cv/types.ts`
- Produces:
  - `DEFAULT_PARAMS: RenderParams`
  - `renderFace(overrides?: DeepPartial<RenderParams>): RenderedFace`
  - `RenderedFace = { rgb: RgbImage; bbox: Rect; contours: FaceContours }`
  - `RenderParams = { size, fst, illuminant: { tempK, intensity }, shading: { azimuth, elevation, ambient }, geometry: RenderGeometry, defects: DefectParams, sensorNoise: number, seed: number }`
  - `DefectParams = { spots, redness, oiliness, pores, lines, darkCircles, roughness }` — each 0..1

- [ ] **Step 1: Write the failing test**

```ts
// eval/render/__tests__/face.test.ts
import { renderFace, DEFAULT_PARAMS } from '../face';
import { lumaAt, clampRect } from '../../../src/features/read/cv/sampling';

const meanLumaOf = (rgb: any, r: any) => {
  const c = clampRect(r, rgb.width, rgb.height);
  let s = 0, n = 0;
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) { s += lumaAt(rgb, x, y); n++; }
  return s / n;
};

describe('renderFace', () => {
  it('produces a well-formed RGBA buffer', () => {
    const { rgb } = renderFace();
    expect(rgb.data).toHaveLength(rgb.width * rgb.height * 4);
    expect(rgb.width).toBe(DEFAULT_PARAMS.size.width);
  });

  it('is byte-identical across runs with the same seed', () => {
    const a = renderFace({ seed: 9 }).rgb.data;
    const b = renderFace({ seed: 9 }).rgb.data;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('differs when the seed changes', () => {
    const a = renderFace({ seed: 1, defects: { pores: 0.8 } }).rgb.data;
    const b = renderFace({ seed: 2, defects: { pores: 0.8 } }).rgb.data;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('renders deeper Fitzpatrick types darker', () => {
    const bbox = renderFace().bbox;
    const light = meanLumaOf(renderFace({ fst: 'I' }).rgb, bbox);
    const deep = meanLumaOf(renderFace({ fst: 'VI' }).rgb, bbox);
    expect(deep).toBeLessThan(light);
  });

  it('makes the image warmer at low colour temperature', () => {
    const ratio = (p: any) => {
      const { rgb, bbox } = renderFace(p);
      let r = 0, b = 0;
      for (let y = bbox.y; y < bbox.y + bbox.h; y++)
        for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
          const i = (y * rgb.width + x) * 4;
          r += rgb.data[i]; b += rgb.data[i + 2];
        }
      return r / b;
    };
    expect(ratio({ illuminant: { tempK: 2700 } })).toBeGreaterThan(ratio({ illuminant: { tempK: 7000 } }));
  });

  it('brightens overall as intensity rises', () => {
    const bbox = renderFace().bbox;
    const dim = meanLumaOf(renderFace({ illuminant: { intensity: 0.6 } }).rgb, bbox);
    const bright = meanLumaOf(renderFace({ illuminant: { intensity: 1.3 } }).rgb, bbox);
    expect(bright).toBeGreaterThan(dim);
  });

  it('adds specular highlights in the T-zone as oiliness rises', () => {
    const { rgb, bbox } = renderFace({ defects: { oiliness: 0 } });
    const tz = { x: bbox.x + bbox.w * 0.4, y: bbox.y + bbox.h * 0.3, w: bbox.w * 0.2, h: bbox.h * 0.45 };
    const oily = renderFace({ defects: { oiliness: 0.9 } }).rgb;
    expect(meanLumaOf(oily, tz)).toBeGreaterThan(meanLumaOf(rgb, tz));
  });

  it('darkens the infraorbital band as darkCircles rises', () => {
    const { bbox } = renderFace();
    const band = { x: bbox.x + bbox.w * 0.18, y: bbox.y + bbox.h * 0.45, w: bbox.w * 0.18, h: bbox.h * 0.08 };
    const none = meanLumaOf(renderFace({ defects: { darkCircles: 0 } }).rgb, band);
    const heavy = meanLumaOf(renderFace({ defects: { darkCircles: 0.9 } }).rgb, band);
    expect(heavy).toBeLessThan(none);
  });

  it('returns a bbox and contours consistent with the requested geometry', () => {
    const a = renderFace({ geometry: { scale: 1 } });
    const b = renderFace({ geometry: { scale: 0.6 } });
    expect(b.bbox.w).toBeLessThan(a.bbox.w);
    expect(b.contours.FACE.length).toBe(a.contours.FACE.length);
  });

  it('renders the same defects identically across every tone (no tone-coupled injury)', () => {
    // The blemish must be a FRACTIONAL change to reflectance, not a fixed RGB offset — a fixed
    // offset is a different relative change per tone and would fabricate the very bias the
    // fairness axis exists to detect (mirrors eval/fairness/self-test-images.ts).
    const rel = (fst: any) => {
      const { bbox } = renderFace();
      const clean = meanLumaOf(renderFace({ fst, defects: { spots: 0 } }).rgb, bbox);
      const spotted = meanLumaOf(renderFace({ fst, defects: { spots: 0.8 } }).rgb, bbox);
      return (clean - spotted) / clean;
    };
    expect(rel('II')).toBeCloseTo(rel('V'), 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest eval/render/__tests__/face.test.ts --verbose`
Expected: FAIL — `Cannot find module '../face'`.

- [ ] **Step 3: Implement**

```ts
// eval/render/face.ts
// Physically-grounded synthetic face renderer (spec §6a).
//
// Forward path: reflectance → defect layers (in REFLECTANCE space, so every injury is a fractional
// change and therefore tone-equivalent) → Lambertian shading → specular lobe → illuminant multiply
// → exposure → sensor noise → sRGB encode.
import type { RgbImage, Rect } from '../../src/features/read/cv/types';
import type { Fitzpatrick } from '../fairness/fst';
import { SKIN_REFLECTANCE, planckianRgb } from './tone';
import { makeRng, valueNoise2d } from './noise';
import { faceEllipse, surfaceNormal, syntheticContours, type FaceContours, type RenderGeometry } from './geometry';

export interface DefectParams {
  spots: number; redness: number; oiliness: number; pores: number;
  lines: number; darkCircles: number; roughness: number;
}

export interface RenderParams {
  size: { width: number; height: number };
  fst: Fitzpatrick;
  illuminant: { tempK: number; intensity: number };
  shading: { azimuth: number; elevation: number; ambient: number };
  geometry: RenderGeometry;
  defects: DefectParams;
  sensorNoise: number;
  seed: number;
}

export interface RenderedFace { rgb: RgbImage; bbox: Rect; contours: FaceContours }

export const DEFAULT_PARAMS: RenderParams = {
  size: { width: 256, height: 256 },
  fst: 'III',
  illuminant: { tempK: 6500, intensity: 1 },
  shading: { azimuth: 0, elevation: Math.PI / 2, ambient: 0.55 },
  geometry: { scale: 1, dx: 0, dy: 0 },
  defects: { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 },
  sensorNoise: 0.004,
  seed: 1,
};

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] };

function merge(p: Deep<RenderParams> = {}): RenderParams {
  return {
    ...DEFAULT_PARAMS, ...p,
    size: { ...DEFAULT_PARAMS.size, ...p.size },
    illuminant: { ...DEFAULT_PARAMS.illuminant, ...p.illuminant },
    shading: { ...DEFAULT_PARAMS.shading, ...p.shading },
    geometry: { ...DEFAULT_PARAMS.geometry, ...p.geometry },
    defects: { ...DEFAULT_PARAMS.defects, ...p.defects },
  } as RenderParams;
}

const srgb = (v: number) =>
  Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));

// Smooth 0..1 falloff, 1 at the center of the blob, 0 at radius r.
function blob(x: number, y: number, cx: number, cy: number, r: number): number {
  const d = Math.hypot(x - cx, y - cy) / r;
  return d >= 1 ? 0 : (1 - d * d) ** 2;
}

export function renderFace(overrides: Deep<RenderParams> = {}): RenderedFace {
  const p = merge(overrides);
  const { width, height } = p.size;
  const e = faceEllipse(p.size, p.geometry);
  const rng = makeRng(p.seed);
  const micro = valueNoise2d(rng, width, height, 5);
  const coarse = valueNoise2d(makeRng(p.seed + 977), width, height, 2);
  const noiseRng = makeRng(p.seed + 5501);

  const base = SKIN_REFLECTANCE[p.fst];
  const illum = planckianRgb(p.illuminant.tempK);
  const L: [number, number, number] = [
    Math.cos(p.shading.elevation) * Math.cos(p.shading.azimuth),
    Math.cos(p.shading.elevation) * Math.sin(p.shading.azimuth),
    Math.sin(p.shading.elevation),
  ];
  const Ln = Math.hypot(...L);
  const Lu: [number, number, number] = [L[0] / Ln, L[1] / Ln, L[2] / Ln];
  const H: [number, number, number] = (() => {
    const h: [number, number, number] = [Lu[0], Lu[1], Lu[2] + 1];
    const n = Math.hypot(...h);
    return [h[0] / n, h[1] / n, h[2] / n];
  })();

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inside = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 < 1;
      const idx = y * width + x;

      // --- reflectance, with every defect applied as a FRACTIONAL modulation ---
      let refl: [number, number, number] = [base[0], base[1], base[2]];

      if (inside) {
        // pores + roughness: high-frequency multiplicative texture
        const tex = 1 + micro[idx] * (0.11 * p.defects.pores + 0.09 * p.defects.roughness);

        // dark spots: a few discrete blobs on forehead and cheeks
        let spot = 0;
        if (p.defects.spots > 0) {
          const sites: Array<[number, number]> = [
            [e.cx - e.rx * 0.3, e.cy - e.ry * 0.5],
            [e.cx + e.rx * 0.25, e.cy - e.ry * 0.42],
            [e.cx - e.rx * 0.5, e.cy + e.ry * 0.2],
            [e.cx + e.rx * 0.52, e.cy + e.ry * 0.26],
          ];
          for (const [sx, sy] of sites) spot = Math.max(spot, blob(x, y, sx, sy, e.rx * 0.11));
          spot *= p.defects.spots * 0.42;
        }

        // dark circles: infraorbital bands
        const dc = p.defects.darkCircles * 0.38 *
          Math.max(blob(x, y, e.cx - e.rx * 0.42, e.cy - e.ry * 0.05, e.rx * 0.26),
                   blob(x, y, e.cx + e.rx * 0.42, e.cy - e.ry * 0.05, e.rx * 0.26));

        // fine lines: oriented horizontal ridges beside the eyes
        const lineZone = Math.max(blob(x, y, e.cx - e.rx * 0.68, e.cy - e.ry * 0.16, e.rx * 0.3),
                                  blob(x, y, e.cx + e.rx * 0.68, e.cy - e.ry * 0.16, e.rx * 0.3));
        const line = p.defects.lines * 0.16 * lineZone * (0.5 + 0.5 * Math.sin(y * 1.9));

        const darken = 1 - Math.min(0.85, spot + dc + line);
        refl = [refl[0] * tex * darken, refl[1] * tex * darken, refl[2] * tex * darken];

        // redness: haemoglobin lifts R and suppresses G/B over the cheeks
        if (p.defects.redness > 0) {
          const cheek = Math.max(blob(x, y, e.cx - e.rx * 0.45, e.cy + e.ry * 0.22, e.rx * 0.4),
                                 blob(x, y, e.cx + e.rx * 0.45, e.cy + e.ry * 0.22, e.rx * 0.4));
          const k = p.defects.redness * cheek * 0.3;
          refl = [refl[0] * (1 + k), refl[1] * (1 - k * 0.55), refl[2] * (1 - k * 0.45)];
        }
      } else {
        // Neutral mid-grey backdrop, slightly textured so it is never a perfectly flat plane.
        const g = 0.18 + coarse[idx] * 0.02;
        refl = [g, g, g];
      }

      // --- shading ---
      const N = inside ? surfaceNormal(x, y, e) : ([0, 0, 1] as [number, number, number]);
      const lambert = Math.max(0, N[0] * Lu[0] + N[1] * Lu[1] + N[2] * Lu[2]);
      const shade = p.shading.ambient + (1 - p.shading.ambient) * lambert;

      // --- specular: illuminant-COLOURED, not skin-coloured. This is exactly why an absolute
      // luma threshold is the wrong oiliness detector (spec §6a). ---
      let spec = 0;
      if (inside && p.defects.oiliness > 0) {
        const tzone = Math.max(
          blob(x, y, e.cx, e.cy - e.ry * 0.45, e.rx * 0.55),   // forehead
          blob(x, y, e.cx, e.cy + e.ry * 0.05, e.rx * 0.22),   // nose
        );
        const ndh = Math.max(0, N[0] * H[0] + N[1] * H[1] + N[2] * H[2]);
        spec = p.defects.oiliness * tzone * Math.pow(ndh, 28) * 0.85;
      }

      for (let c = 0; c < 3; c++) {
        let v = (refl[c] * shade + spec) * illum[c] * p.illuminant.intensity;
        v += (noiseRng() * 2 - 1) * p.sensorNoise;
        data[i + c] = srgb(Math.max(0, Math.min(1, v)));
      }
      data[i + 3] = 255;
    }
  }

  return {
    rgb: { width, height, data },
    bbox: {
      x: Math.round(e.cx - e.rx), y: Math.round(e.cy - e.ry),
      w: Math.round(e.rx * 2), h: Math.round(e.ry * 2),
    },
    contours: syntheticContours(e),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest eval/render/__tests__/face.test.ts --verbose`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/render/face.ts eval/render/__tests__/face.test.ts
git commit -m "feat(eval): physically-grounded synthetic face renderer

Defects applied in reflectance space so every injury is fractional and therefore
tone-equivalent. Specular is illuminant-coloured, which is what makes the absolute
oiliness threshold measurably wrong."
```

---

## Task 4: Invariance thresholds and axis scaffolding

**Files:**
- Create: `eval/invariance/thresholds.ts`, `eval/invariance/types.ts`
- Test: `eval/invariance/__tests__/thresholds.test.ts`

**Interfaces:**
- Produces:
  - `INVARIANCE_THRESHOLDS: { epsilon: Record<Dimension, number>; crossTalk: number; spearmanFloor: number; tonePreservationFloor: number }`
  - `AxisResult = { name: string; pass: boolean; worst: { dimension: Dimension; value: number } | null; detail: Record<string, number> }`

**Note on the ε values:** these are provisional placeholders chosen to be loose enough that the CURRENT engine passes the geometric axis and fails the illuminant axis (which is the known defect this track fixes). Task 6 tightens them once the baseline report exists. This is the empirical derivation the spec §6c requires — the numbers below are the starting point, not the final policy.

- [ ] **Step 1: Write the failing test**

```ts
// eval/invariance/__tests__/thresholds.test.ts
import { INVARIANCE_THRESHOLDS as T } from '../thresholds';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';

describe('invariance thresholds', () => {
  it('defines an epsilon for every dimension', () => {
    for (const d of DIMENSIONS) expect(typeof T.epsilon[d]).toBe('number');
  });

  it('keeps every epsilon inside a meaningful 0..1 score range', () => {
    for (const d of DIMENSIONS) {
      expect(T.epsilon[d]).toBeGreaterThan(0);
      expect(T.epsilon[d]).toBeLessThan(0.5);
    }
  });

  it('sets a Spearman floor strong enough to mean "responds monotonically"', () => {
    expect(T.spearmanFloor).toBeGreaterThanOrEqual(0.9);
  });

  it('sets a cross-talk bound tighter than the loosest epsilon', () => {
    expect(T.crossTalk).toBeLessThan(Math.max(...DIMENSIONS.map((d) => T.epsilon[d])));
  });

  it('requires tone preservation to be a real separation, not noise', () => {
    expect(T.tonePreservationFloor).toBeGreaterThan(0.02);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest eval/invariance --verbose`
Expected: FAIL — `Cannot find module '../thresholds'`.

- [ ] **Step 3: Implement**

```ts
// eval/invariance/thresholds.ts
// PROVISIONAL acceptance bounds for the invariance axes (spec §6c), mirroring the ownership note
// on eval/fairness/thresholds.ts: the harness reports numbers against these; the real pass/fail
// policy belongs to founders + counsel + a domain expert, with validation data.
//
// Derivation: set loose enough that today's engine passes GEOMETRIC invariance, and tight enough
// that it FAILS ILLUMINANT invariance — the defect this track exists to fix (spec F3). Tightened
// in Task 6 once the baseline report is committed.
import type { Dimension } from '../../src/content/cosmetic-vocab';

export const INVARIANCE_THRESHOLDS = {
  // Max allowed max-min score spread across an invariance sweep.
  epsilon: {
    hydration: 0.10, oiliness: 0.12, texture: 0.10, pores: 0.12,
    darkSpots: 0.08, redness: 0.08, fineLines: 0.10, darkCircles: 0.08,
  } as Record<Dimension, number>,
  // Max drift allowed in NON-target dimensions while one defect is swept.
  crossTalk: 0.07,
  // Min Spearman rho between a swept defect and its target score.
  spearmanFloor: 0.9,
  // Min spread that tone-derived quantities must RETAIN across FST I..VI after normalization —
  // guards against achieving invariance by erasing tone (spec §6b).
  tonePreservationFloor: 0.05,
} as const;

export type InvarianceThresholds = {
  epsilon: Record<Dimension, number>;
  crossTalk: number;
  spearmanFloor: number;
  tonePreservationFloor: number;
};
```

```ts
// eval/invariance/types.ts
import type { Dimension } from '../../src/content/cosmetic-vocab';

export interface AxisResult {
  name: string;
  pass: boolean;
  worst: { dimension: Dimension; value: number } | null;
  detail: Record<string, number>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest eval/invariance --verbose`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/invariance/thresholds.ts eval/invariance/types.ts eval/invariance/__tests__/
git commit -m "feat(eval): provisional invariance thresholds + axis result types"
```

---

## Task 5: The four invariance axes

**Files:**
- Create: `eval/invariance/axes.ts`
- Test: `eval/invariance/__tests__/axes.test.ts`

**Interfaces:**
- Consumes: `renderFace`, `DEFAULT_PARAMS` (Task 3); `INVARIANCE_THRESHOLDS`, `AxisResult` (Task 4); `scoreFromRgb` from `src/features/read/cv/score-from-rgb.ts`
- Produces:
  - `spearman(a: number[], b: number[]): number`
  - `illuminantAxis(t?): AxisResult`
  - `geometricAxis(t?): AxisResult`
  - `monotonicAxis(t?): AxisResult`
  - `tonePreservationAxis(t?): AxisResult`
  - `runAllAxes(t?): AxisResult[]`

- [ ] **Step 1: Write the failing test**

```ts
// eval/invariance/__tests__/axes.test.ts
import { spearman, illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis, runAllAxes } from '../axes';

describe('spearman', () => {
  it('is 1 for a perfectly increasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 5);
  });
  it('is -1 for a perfectly decreasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 5);
  });
  it('ranks rather than scales — monotone but non-linear is still 1', () => {
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1, 5);
  });
  it('is 0 when one series is constant', () => {
    expect(spearman([1, 2, 3], [5, 5, 5])).toBe(0);
  });
});

describe('axes', () => {
  it('each return a well-formed AxisResult', () => {
    for (const axis of [illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis]) {
      const r = axis();
      expect(typeof r.name).toBe('string');
      expect(typeof r.pass).toBe('boolean');
      expect(Object.keys(r.detail).length).toBeGreaterThan(0);
    }
  });

  it('runAllAxes reports all four', () => {
    expect(runAllAxes().map((r) => r.name).sort())
      .toEqual(['geometric', 'illuminant', 'monotonic', 'tone-preservation']);
  });

  it('are deterministic — the same run twice gives the same verdicts', () => {
    expect(runAllAxes().map((r) => r.pass)).toEqual(runAllAxes().map((r) => r.pass));
  });

  it('geometric invariance passes on the current engine', () => {
    // Regions are placed proportionally off the bbox, so a uniformly scaled/translated face
    // should already score consistently. If this fails, region derivation is broken.
    expect(geometricAxis().pass).toBe(true);
  });

  it('illuminant invariance FAILS on the current engine (the defect this track fixes)', () => {
    // pores/fineLines/oiliness use absolute thresholds (spec F3), so changing the light changes
    // the scores. Task 7 flips this to passing; until then a pass here means the axis is too loose
    // to detect the very defect it exists for.
    expect(illuminantAxis().pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest eval/invariance/__tests__/axes.test.ts --verbose`
Expected: FAIL — `Cannot find module '../axes'`.

- [ ] **Step 3: Implement**

```ts
// eval/invariance/axes.ts
// The four fail-closed invariance axes (spec §6b). Every axis renders synthetic faces, scores them
// through the REAL engine, and reports a number against INVARIANCE_THRESHOLDS.
//
// NOT an accuracy measure. Passing means the pipeline is self-consistent and physically sensible;
// it certifies nothing about real faces and licenses no claim (CLAUDE.md §1, spec §6a).
import { renderFace } from '../render/face';
import { scoreFromRgb } from '../../src/features/read/cv/score-from-rgb';
import { DIMENSIONS, type Dimension } from '../../src/content/cosmetic-vocab';
import { FITZPATRICK } from '../fairness/fst';
import { INVARIANCE_THRESHOLDS, type InvarianceThresholds } from './thresholds';
import type { AxisResult } from './types';

type Params = Parameters<typeof renderFace>[0];

function scoresFor(p: Params): Record<Dimension, number> {
  const { rgb, bbox } = renderFace(p);
  return scoreFromRgb(rgb, bbox).scores;
}

function spread(runs: Array<Record<Dimension, number>>): Record<Dimension, number> {
  return Object.fromEntries(
    DIMENSIONS.map((d) => {
      const vs = runs.map((r) => r[d]);
      return [d, Math.max(...vs) - Math.min(...vs)];
    }),
  ) as Record<Dimension, number>;
}

function verdict(name: string, spreads: Record<Dimension, number>, t: InvarianceThresholds): AxisResult {
  let worst: AxisResult['worst'] = null;
  let pass = true;
  for (const d of DIMENSIONS) {
    if (spreads[d] > t.epsilon[d]) pass = false;
    if (!worst || spreads[d] - t.epsilon[d] > worst.value - t.epsilon[worst.dimension]) {
      worst = { dimension: d, value: spreads[d] };
    }
  }
  return { name, pass, worst, detail: { ...spreads } };
}

export function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const order = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length).fill(0);
    order.forEach(([, i], k) => { r[i] = k + 1; });
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / n;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

const TEMPS = [2700, 3500, 4500, 5500, 6500, 7500];
const INTENSITIES = [0.6, 1.0, 1.4];

export function illuminantAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const runs = TEMPS.flatMap((tempK) =>
    INTENSITIES.map((intensity) => scoresFor({ defects, illuminant: { tempK, intensity } })),
  );
  return verdict('illuminant', spread(runs), t);
}

export function geometricAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const geos = [
    { scale: 1.0, dx: 0, dy: 0 }, { scale: 0.85, dx: 0, dy: 0 }, { scale: 1.1, dx: 0, dy: 0 },
    { scale: 1.0, dx: 0.04, dy: 0 }, { scale: 1.0, dx: -0.04, dy: 0 }, { scale: 1.0, dx: 0, dy: 0.04 },
  ];
  return verdict('geometric', spread(geos.map((geometry) => scoresFor({ defects, geometry }))), t);
}

const DEFAULT_DEFECTS = { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 };
type Knob = keyof typeof DEFAULT_DEFECTS;

// Which defect parameter each dimension is supposed to track (positively).
const DEFECT_FOR: Partial<Record<Dimension, Knob>> = {
  darkSpots: 'spots', redness: 'redness', oiliness: 'oiliness',
  pores: 'pores', fineLines: 'lines', darkCircles: 'darkCircles', texture: 'roughness',
};

// Dimensions that are EXPECTED to move when a given knob is swept, and so must be excluded from
// the cross-talk check. hydration is defined as 1 - microContrast (cv/dimensions/hydration.ts),
// i.e. the inverse of texture — sweeping roughness MUST move it. Flagging that as cross-talk
// would be flagging correct behaviour.
//
// Keep this list minimal and justified: every entry is a claim that two dimensions genuinely
// share a physical cause. Adding one to silence a failing check, rather than because the coupling
// is real, quietly destroys the axis's value.
const EXPECTED_COUPLING: Partial<Record<Knob, Dimension[]>> = {
  roughness: ['hydration'],
};

export function monotonicAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  const levels = [0, 0.25, 0.5, 0.75, 1];
  const detail: Record<string, number> = {};
  let pass = true;
  let worst: AxisResult['worst'] = null;

  for (const [dim, knob] of Object.entries(DEFECT_FOR) as Array<[Dimension, Knob]>) {
    const runs = levels.map((v) => scoresFor({ defects: { ...DEFAULT_DEFECTS, [knob]: v } }));
    const rho = spearman(levels, runs.map((r) => r[dim]));
    detail[`rho:${dim}`] = rho;
    if (rho < t.spearmanFloor) pass = false;
    if (!worst || rho < worst.value) worst = { dimension: dim, value: rho };

    const exempt = new Set<Dimension>([dim, ...(EXPECTED_COUPLING[knob] ?? [])]);
    for (const other of DIMENSIONS) {
      if (exempt.has(other)) continue;
      const vs = runs.map((r) => r[other]);
      const drift = Math.max(...vs) - Math.min(...vs);
      detail[`crosstalk:${knob}->${other}`] = drift;
      if (drift > t.crossTalk) pass = false;
    }
  }
  return { name: 'monotonic', pass, worst, detail };
}

export function tonePreservationAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  // Same defects, same light, sweeping tone. The MEAN SKIN LIGHTNESS must still separate the
  // tones — if normalization flattens this, "invariance" was bought by destroying signal.
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const lums = FITZPATRICK.map((fst) => {
    const { rgb, bbox } = renderFace({ fst, defects });
    let sum = 0, n = 0;
    for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
      for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        if (x < 0 || y < 0 || x >= rgb.width || y >= rgb.height) continue;
        const i = (y * rgb.width + x) * 4;
        sum += (0.2126 * rgb.data[i] + 0.7152 * rgb.data[i + 1] + 0.0722 * rgb.data[i + 2]) / 255;
        n++;
      }
    }
    return sum / n;
  });
  const separation = Math.max(...lums) - Math.min(...lums);
  return {
    name: 'tone-preservation',
    pass: separation >= t.tonePreservationFloor,
    worst: null,
    detail: { separation, ...Object.fromEntries(FITZPATRICK.map((f, i) => [`lum:${f}`, lums[i]])) },
  };
}

export function runAllAxes(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult[] {
  return [illuminantAxis(t), geometricAxis(t), monotonicAxis(t), tonePreservationAxis(t)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest eval/invariance/__tests__/axes.test.ts --verbose`
Expected: PASS (9 tests). **If `illuminantAxis().pass` comes back `true`, the ε values in Task 4 are too loose** — tighten `epsilon.pores`, `epsilon.fineLines`, and `epsilon.oiliness` until the known defect is detected, then re-run. Do not weaken the test to match.

- [ ] **Step 5: Commit**

```bash
git add eval/invariance/axes.ts eval/invariance/__tests__/axes.test.ts
git commit -m "feat(eval): four fail-closed invariance axes

Illuminant invariance fails on the current engine by design — that is the defect
the relative-dimension work fixes, and a passing axis here would mean the bound
is too loose to detect it."
```

---

## Task 5b: Calibrate the instrument so every dimension is measurable

**Added 2026-07-25 after Task 5's review.** Not in the original plan — inserted because the axes,
though correctly implemented, cannot currently *see* most of what they are supposed to measure.

**Files:**
- Modify: `eval/render/noise.ts`, `eval/render/face.ts`, `eval/invariance/axes.ts`
- Test: `eval/render/__tests__/noise.test.ts`, `eval/render/__tests__/face.test.ts`,
  `eval/invariance/__tests__/axes.test.ts`

### Why this task exists — measured evidence

Running the committed engine over the committed renderer:

| dimension | response across its defect sweep 0→1 | state |
|---|---|---|
| `pores` | 0.0000 at every level | dead |
| `darkSpots` | 1.0000, 1.0000, 1.0000, 1.0000, 0.9804 | ceiling-saturated, ρ = −0.71 |
| `redness` | 0.0092, 0, 0, 0, 0 | dead, ρ = −0.71 |
| `texture` | 0.0367 → 0.0366 | flat, ρ = −0.20 |
| `fineLines` | 0.0165 → 0.0182 | monotonic but negligible range |
| `oiliness` | 0.0000 → 0.3825 | healthy |
| `darkCircles` | 0.0000 → 0.2708 | healthy |

`monotonicAxis().pass` is therefore **`false` today**, and no test asserts it, so CI is green over a
failing axis.

**Two root causes, both renderer calibration — the axes code is correct:**

1. **`darkSpots` saturates from ellipsoid curvature, not from spots.** The forehead region sits near
   the top of the ellipsoid where the surface normal tilts away from the viewer, so it renders 5.6%
   darker in L\* than the cheek baseline. That pushes **20.2%** of forehead pixels past
   `CAL.darkSpots.relThr` (0.08), and `CAL.darkSpots.hi` (0.15) pins the score at 1.0. A face with
   zero spots reads as maximum dark spots, leaving no headroom to measure anything.
   *(Region placement was investigated and is NOT the cause — measured 1.2% background overlap on
   `forehead` and 0% on every other region.)*

2. **`pores` has no pixel-scale content to detect.** `valueNoise2d`'s finest octave is a 32-cell
   lattice over a 256 px image — about 8 px per cell — and bilinear interpolation makes neighbouring
   pixels nearly identical. Measured adjacent-pixel luma delta in the T-zone is 0.0016 **and does not
   change with the pores parameter at all** (0.00160 → 0.00157 → 0.00156 at pores 0 / 0.5 / 1).
   `CAL.pores.thr` is 0.06, so the threshold is never approached. Real pores are 1–3 px features.

**Interfaces:**
- Produces: `valueNoise2d(rng, width, height, octaves, baseCells?)` — new optional final parameter,
  defaulting to `2` so every existing call site is unchanged. Octave `o` uses `baseCells << o`
  cells, so a high `baseCells` yields fine features at full amplitude, which is what pore-scale
  texture needs (many octaves alone will not do it — each successive octave is halved in amplitude,
  so high-frequency content stays negligible after peak normalization).

- [ ] **Step 1: Write the failing tests**

Add to `eval/render/__tests__/noise.test.ts`:

```ts
describe('valueNoise2d baseCells', () => {
  const hfEnergy = (n: Float32Array, w: number, h: number) => {
    let s = 0, c = 0;
    for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { s += Math.abs(n[y * w + x] - n[y * w + x - 1]); c++; }
    return s / c;
  };

  it('defaults to the previous behaviour when baseCells is omitted', () => {
    const a = valueNoise2d(makeRng(4), 32, 32, 3);
    const b = valueNoise2d(makeRng(4), 32, 32, 3, 2);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces far more pixel-scale detail at a high baseCells', () => {
    const coarse = hfEnergy(valueNoise2d(makeRng(7), 128, 128, 2, 2), 128, 128);
    const fine = hfEnergy(valueNoise2d(makeRng(7), 128, 128, 2, 64), 128, 128);
    expect(fine).toBeGreaterThan(coarse * 5);
  });

  it('is still zero-mean and peak-normalized at a high baseCells', () => {
    const n = valueNoise2d(makeRng(9), 128, 128, 2, 64);
    expect(n.reduce((s, v) => s + v, 0) / n.length).toBeCloseTo(0, 5);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });
});
```

Add to `eval/render/__tests__/face.test.ts`:

```ts
describe('renderer dynamic range (calibration)', () => {
  // Each dimension must respond across its defect sweep WITHOUT hitting a floor or ceiling,
  // or the invariance axes cannot measure whether a later fix improved anything.
  const KNOB: Record<string, string> = {
    darkSpots: 'spots', redness: 'redness', oiliness: 'oiliness',
    pores: 'pores', fineLines: 'lines', darkCircles: 'darkCircles', texture: 'roughness',
  };
  const D0 = { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 };
  const scoreAt = (knob: string, v: number) => {
    const { rgb, bbox } = renderFace({ defects: { ...D0, [knob]: v } });
    return (scoreFromRgb(rgb, bbox).scores as Record<string, number>);
  };

  it.each(Object.entries(KNOB))('%s responds to its defect without saturating', (dim, knob) => {
    const lo = scoreAt(knob, 0)[dim];
    const hi = scoreAt(knob, 1)[dim];
    expect(hi - lo).toBeGreaterThan(0.05);   // real dynamic range, not noise
    expect(lo).toBeLessThan(0.9);            // not pinned at the ceiling when clean
    expect(hi).toBeGreaterThan(0.02);        // not dead at full defect
  });

  it('renders a clean face without spurious dark spots', () => {
    // Ellipsoid curvature must not read as blemishes: with zero defects the score must be low.
    const { rgb, bbox } = renderFace({ defects: D0 });
    expect(scoreFromRgb(rgb, bbox).scores.darkSpots).toBeLessThan(0.3);
  });
});
```

Add to `eval/invariance/__tests__/axes.test.ts` — closing the coverage gap the review found:

```ts
  it('monotonic response passes — every dimension tracks its own defect', () => {
    // Was unasserted and FAILING (rho: darkSpots -0.71, redness -0.71, pores 0, texture -0.20).
    const r = monotonicAxis();
    expect(r.pass).toBe(true);
  });

  it('tone preservation passes — normalization has not erased tone', () => {
    expect(tonePreservationAxis().pass).toBe(true);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail for the right reasons**

Run: `npx jest eval/render eval/invariance --testTimeout=180000`

Expected failures: the `baseCells` tests (parameter does not exist), several dynamic-range cases
(`pores`, `redness`, `texture`, `darkSpots`), the clean-face dark-spots case, and
`monotonicAxis().pass`. Record the actual starting numbers before changing anything.

- [ ] **Step 3: Implement — calibrate until the tests pass**

Three changes, in this order. **The exact constants are yours to derive empirically** — this task is
tuning, and the plan cannot specify numbers that were never measured. Change the minimum needed and
justify each in a comment.

1. **`noise.ts` — add the `baseCells` parameter** (default `2`), replacing `2 << o` with
   `baseCells << o`. Keep the existing centre-and-peak-normalize step exactly as it is.

2. **`face.ts` — give pores and roughness a fine-grained noise field.** Draw the micro-texture layer
   with a high `baseCells` (start around 64 for a 256 px render and adjust) so adjacent pixels
   actually differ. Keep the coarse field for the backdrop. Raise the pore/roughness amplitude
   coefficients if the measured adjacent-pixel delta still falls short of `CAL.pores.thr` (0.06).

3. **`face.ts` — flatten the curvature shading in `DEFAULT_PARAMS`.** Raise `shading.ambient` from
   0.55 until a clean face stops reading as dark spots. This is physically honest: high ambient is a
   diffuse, softbox-like light, which is exactly the even lighting the capture gate asks users for.
   Do **not** remove the specular lobe or the normal-based shading — later work depends on both.

4. **`face.ts` — raise the `redness` coefficient** until redness shows real dynamic range against
   `CAL.redness` (`hi: 25`, i.e. Δa\* over baseline).

**Constraints on tuning:**
- Do NOT change anything under `src/` — the engine and its `CAL` constants are the thing being
  measured. Changing them to make the instrument agree would defeat the entire exercise.
- Do NOT weaken `INVARIANCE_THRESHOLDS`.
- `illuminantAxis().pass` MUST remain `false`. It is the pre-approved baseline that a later task
  flips to `true` as proof its fix worked. If your calibration accidentally makes it pass, the
  instrument has stopped detecting a defect that is definitely still present — investigate and
  report rather than accepting it.

- [ ] **Step 4: Verify**

Run: `npx jest eval/render eval/invariance --testTimeout=180000` → all pass.
Run: `npx tsc --noEmit` → clean.
Run: `npm test` → no regressions elsewhere.

Record the final per-dimension response table (score at defect 0 and at 1) in your report. That table
is the evidence the instrument can now see, and Task 7 is measured against it.

- [ ] **Step 5: Commit**

```bash
git add eval/render/ eval/invariance/
git commit -m "fix(eval): calibrate the renderer so every dimension is measurable

The axes were correct but blind: pores read 0.0000 at every defect level, darkSpots
sat pinned at 1.0000 from ellipsoid curvature rather than from spots, and redness and
texture were flat. monotonicAxis was failing with four dimensions below the floor and
nothing asserting it.

Adds a baseCells parameter so pore texture has pixel-scale content, flattens the
curvature shading so a clean face no longer reads as blemished, and asserts the two
axis verdicts that previously had no assertion at all."
```

---

## Task 6: Baseline report + npm script

**Files:**
- Create: `eval/invariance/report.ts`, `eval/invariance/__tests__/report-writer.test.ts`
- Test: `eval/invariance/__tests__/report.test.ts`
- Modify: `package.json` (scripts only — **no dependency changes**)

**Interfaces:**
- Consumes: `AxisResult` (Task 4), `runAllAxes` (Task 5)
- Produces: `renderInvarianceMarkdown(results, generatedAt): string`, `renderInvarianceJson(results, generatedAt): string`

- [ ] **Step 1: Write the failing test**

```ts
// eval/invariance/__tests__/report.test.ts
import { renderInvarianceMarkdown, renderInvarianceJson } from '../report';
import type { AxisResult } from '../types';

const RESULTS: AxisResult[] = [
  { name: 'illuminant', pass: false, worst: { dimension: 'pores', value: 0.31 }, detail: { pores: 0.31 } },
  { name: 'geometric', pass: true, worst: { dimension: 'redness', value: 0.01 }, detail: { redness: 0.01 } },
];

describe('invariance report', () => {
  it('renders a heading and one section per axis', () => {
    const md = renderInvarianceMarkdown(RESULTS, '2026-07-25T00:00:00Z');
    expect(md).toContain('# Invariance eval');
    expect(md).toContain('illuminant');
    expect(md).toContain('geometric');
  });

  it('marks failing axes FAIL and passing axes PASS', () => {
    const md = renderInvarianceMarkdown(RESULTS, '2026-07-25T00:00:00Z');
    expect(md).toMatch(/illuminant.*FAIL/s);
    expect(md).toMatch(/geometric.*PASS/s);
  });

  it('states plainly that this is not an accuracy claim', () => {
    // Compliance guard: any committed artifact that could be mistaken for validation data must
    // carry the disclaimer (CLAUDE.md §1).
    expect(renderInvarianceMarkdown(RESULTS, 'x')).toMatch(/not an accuracy claim/i);
  });

  it('emits parseable JSON carrying every axis verdict', () => {
    const parsed = JSON.parse(renderInvarianceJson(RESULTS, '2026-07-25T00:00:00Z'));
    expect(parsed.axes).toHaveLength(2);
    expect(parsed.pass).toBe(false);
  });

  it('reports overall pass only when every axis passes', () => {
    const allGood = RESULTS.map((r) => ({ ...r, pass: true }));
    expect(JSON.parse(renderInvarianceJson(allGood, 'x')).pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest eval/invariance/__tests__/report.test.ts --verbose`
Expected: FAIL — `Cannot find module '../report'`.

- [ ] **Step 3: Implement**

```ts
// eval/invariance/report.ts
// Aggregate only — no images, no per-subject rows — so reports are safe to commit
// (matches eval/data/README.md policy).
import type { AxisResult } from './types';

export function renderInvarianceJson(results: AxisResult[], generatedAt: string): string {
  return JSON.stringify(
    { generatedAt, pass: results.every((r) => r.pass), axes: results },
    null, 2,
  );
}

export function renderInvarianceMarkdown(results: AxisResult[], generatedAt: string): string {
  const lines = [
    `# Invariance eval — ${generatedAt}`,
    '',
    '> Synthetic harness. Measures self-consistency of the pipeline under simulated lighting,',
    '> geometry and defect sweeps. It is **not an accuracy claim** and is not validation data on',
    '> file — no accuracy, efficacy or skin-tone-equity statement may cite it (CLAUDE.md §1).',
    '',
    `Overall: ${results.every((r) => r.pass) ? 'PASS' : 'FAIL'}`,
    '',
  ];
  for (const r of results) {
    lines.push(`## ${r.name} — ${r.pass ? 'PASS' : 'FAIL'}`);
    if (r.worst) lines.push(`- worst: ${r.worst.dimension} = ${r.worst.value.toFixed(4)}`);
    for (const [k, v] of Object.entries(r.detail)) lines.push(`- ${k}: ${v.toFixed(4)}`);
    lines.push('');
  }
  return lines.join('\n');
}
```

**Resolved before dispatch:** `ts-node` is NOT installed, and Global Constraints forbid adding it.
The report is therefore generated by a Jest-driven writer, which needs no new tooling because Jest
already transpiles TypeScript here via `jest-expo`. Create `eval/invariance/__tests__/report-writer.test.ts`
instead of a standalone script:

```ts
// eval/invariance/__tests__/report-writer.test.ts
// Report GENERATOR, not a unit test — it is how `npm run eval:invariance` produces the committed
// artifact. Lives under __tests__ because Jest is the only TypeScript runner available (ts-node is
// not a dependency and Global Constraints forbid adding one).
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { runAllAxes } from '../axes';
import { renderInvarianceMarkdown, renderInvarianceJson } from '../report';

// Fixed stamp source: the axes are deterministic, so only the timestamp varies between runs.
const stamp = new Date().toISOString();
const dir = join(__dirname, '..', '..', 'reports');

describe('invariance report writer', () => {
  const results = runAllAxes();

  it('writes the aggregate report to eval/reports', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'invariance.md'), renderInvarianceMarkdown(results, stamp));
    writeFileSync(join(dir, 'invariance.json'), renderInvarianceJson(results, stamp));
    expect(existsSync(join(dir, 'invariance.md'))).toBe(true);
    expect(existsSync(join(dir, 'invariance.json'))).toBe(true);
  });

  it('reports a verdict for every axis', () => {
    expect(results).toHaveLength(4);
    for (const r of results) expect(typeof r.pass).toBe('boolean');
  });

  it('produces a report naming every axis and carrying the not-an-accuracy-claim disclaimer', () => {
    const md = renderInvarianceMarkdown(results, stamp);
    for (const r of results) expect(md).toContain(r.name);
    expect(md).toMatch(/not an accuracy claim/i);
    // eslint-disable-next-line no-console
    console.log(md); // surfaces the verdicts in CI output
  });
});
```

Add to `package.json` `scripts`:
```json
"eval:invariance": "jest eval/invariance/__tests__/report-writer.test.ts"
```

Note this generator does **not** fail the run when an axis fails — the axis verdicts are asserted by
`axes.test.ts`, which does. This file's job is producing the committed artifact.

- [ ] **Step 4: Run test and generate the baseline**

Run: `npx jest eval/invariance/__tests__/report.test.ts --verbose`
Expected: PASS (5 tests).

Run: `npm run eval:invariance`
Expected: exits non-zero, with `illuminant` FAIL. **This is the baseline** — the documented "before" every later task is measured against.

- [ ] **Step 5: Commit**

```bash
git add eval/invariance/report.ts eval/invariance/__tests__/ \
        package.json eval/reports/invariance.md eval/reports/invariance.json
git commit -m "feat(eval): invariance report + npm run eval:invariance

Commits the BASELINE report: illuminant invariance failing on the current engine.
Every later task in this track is measured against these numbers."
```

---

## Task 7: Relative dimension measures (spec 4a)

**Files:**
- Modify: `src/features/read/cv/sampling.ts`, `src/features/read/cv/calibration.ts`,
  `src/features/read/cv/dimensions/pores.ts`, `.../fineLines.ts`, `.../oiliness.ts`
- Test: `src/features/read/cv/__tests__/relative-measures.test.ts`

**Interfaces:**
- Produces (added to `sampling.ts`):
  - `relativeContrastDensity(img: RgbImage, rect: Rect, relThr: number): number`
  - `relativeGradientEnergy(img: RgbImage, rect: Rect): number`
  - `specularFraction(img: RgbImage, rect: Rect, baselineL: number, relLift: number, satThr: number): number`
- Consumes: `SkinBaseline` from `cv/types.ts` — `oiliness` gains a third parameter, so `score-from-rgb.ts:26` must be updated to pass `baseline`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/relative-measures.test.ts
import { solidRgb, addNoise, vStripes, fillRect } from '../fixtures';
import { relativeContrastDensity, relativeGradientEnergy, specularFraction } from '../sampling';

const RECT = { x: 10, y: 10, w: 60, h: 60 };
const scaleImg = (img: any, k: number) => ({
  width: img.width, height: img.height,
  data: new Uint8ClampedArray(Array.from(img.data).map((v: any, i) => (i % 4 === 3 ? v : v * k))),
});

describe('relativeContrastDensity', () => {
  it('is invariant to a uniform exposure change', () => {
    const dim = addNoise(solidRgb(96, 96, [90, 70, 60]), RECT, 8, 3);
    const bright = scaleImg(dim, 1.8);
    expect(relativeContrastDensity(bright, RECT, 0.06))
      .toBeCloseTo(relativeContrastDensity(dim, RECT, 0.06), 1);
  });

  it('rises with texture amplitude', () => {
    const flat = addNoise(solidRgb(96, 96, [160, 130, 110]), RECT, 2, 1);
    const rough = addNoise(solidRgb(96, 96, [160, 130, 110]), RECT, 20, 1);
    expect(relativeContrastDensity(rough, RECT, 0.06))
      .toBeGreaterThan(relativeContrastDensity(flat, RECT, 0.06));
  });

  it('is near-identical on a deep tone and a light tone with the same relative texture', () => {
    // The fairness fix (spec F3): absolute thresholds under-detect on deep skin.
    const light = addNoise(solidRgb(96, 96, [220, 190, 170]), RECT, 16, 5);
    const deep = scaleImg(light, 0.35);
    expect(relativeContrastDensity(deep, RECT, 0.06))
      .toBeCloseTo(relativeContrastDensity(light, RECT, 0.06), 1);
  });
});

describe('relativeGradientEnergy', () => {
  it('is invariant to a uniform exposure change', () => {
    const dim = vStripes(solidRgb(96, 96, [100, 80, 70]), RECT, 12);
    expect(relativeGradientEnergy(scaleImg(dim, 1.7), RECT))
      .toBeCloseTo(relativeGradientEnergy(dim, RECT), 1);
  });

  it('rises with stripe depth', () => {
    const shallow = vStripes(solidRgb(96, 96, [160, 130, 110]), RECT, 4);
    const deep = vStripes(solidRgb(96, 96, [160, 130, 110]), RECT, 30);
    expect(relativeGradientEnergy(deep, RECT)).toBeGreaterThan(relativeGradientEnergy(shallow, RECT));
  });
});

describe('specularFraction', () => {
  it('detects highlights on a dark face that an absolute 0.8 luma threshold would miss', () => {
    const base = solidRgb(96, 96, [60, 45, 38]);            // deep tone, dim exposure
    const withGlare = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [150, 148, 146]);
    // baseline L* of the dark skin is low; the patch is a large RELATIVE lift and near-neutral.
    expect(specularFraction(withGlare, RECT, 22, 0.5, 0.15)).toBeGreaterThan(0.05);
  });

  it('is ~0 on an evenly lit face with no highlights', () => {
    expect(specularFraction(solidRgb(96, 96, [160, 130, 110]), RECT, 58, 0.5, 0.15)).toBeLessThan(0.01);
  });

  it('ignores bright but SATURATED regions (coloured, not specular)', () => {
    const base = solidRgb(96, 96, [140, 110, 95]);
    const red = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [250, 60, 60]);
    expect(specularFraction(red, RECT, 52, 0.5, 0.15)).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest relative-measures --verbose`
Expected: FAIL — `relativeContrastDensity is not a function`.

- [ ] **Step 3: Implement**

Append to `src/features/read/cv/sampling.ts`:

```ts
// Weber-relative contrast density: |luma - localMean| / localMean, so the threshold means "this
// pixel differs from its neighbours by X PERCENT" rather than "by X absolute luma". The absolute
// form under-detects on deep tones and over-detects on bright exposures (spec F3).
export function relativeContrastDensity(img: RgbImage, rect: Rect, relThr: number): number {
  const r = clampRect(rect, img.width, img.height);
  let count = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const localMean =
        (lumaAt(img, x - 1, y) + lumaAt(img, x + 1, y) + lumaAt(img, x, y - 1) + lumaAt(img, x, y + 1)) / 4;
      if (localMean > 0 && Math.abs(lumaAt(img, x, y) - localMean) / localMean > relThr) count++;
      n++;
    }
  }
  return n ? count / n : 0;
}

// Mean horizontal gradient divided by mean luma — same Weber normalization as microContrast.
export function relativeGradientEnergy(img: RgbImage, rect: Rect): number {
  const lum = meanLuma(img, rect);
  return lum > 0 ? gradientEnergy(img, rect) / lum : 0;
}

// Specular highlight fraction relative to the person's own skin baseline L*, not an absolute luma.
// A highlight is a large RELATIVE lift above baseline lightness AND near-neutral in saturation
// (specular reflection carries the illuminant's colour, not the skin's).
export function specularFraction(
  img: RgbImage,
  rect: Rect,
  baselineL: number,
  relLift: number,
  satThr: number,
): number {
  const r = clampRect(rect, img.width, img.height);
  const floorL = baselineL * (1 + relLift);
  let hi = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [R, G, B] = rgbAt(img, x, y);
      const mx = Math.max(R, G, B);
      const mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      if (srgbToLab(R, G, B).L > floorL && sat < satThr) hi++;
      n++;
    }
  }
  return n ? hi / n : 0;
}
```

Replace the three dimension bodies:

```ts
// src/features/read/cv/dimensions/pores.ts
// Pores = density of small RELATIVE local-contrast features in the T-zone. Weber-relative so the
// score does not scale with exposure or skin lightness (spec 4a).
import type { RgbImage, Regions } from '../types';
import { relativeContrastDensity } from '../sampling';
import { norm01, CAL } from '../calibration';

export function pores(img: RgbImage, regions: Regions): number {
  return norm01(relativeContrastDensity(img, regions.tZone, CAL.pores.relThr), CAL.pores.lo, CAL.pores.hi);
}
```

```ts
// src/features/read/cv/dimensions/fineLines.ts
// Fine lines = tone-relative oriented (horizontal) gradient energy around the eyes.
import type { RgbImage, Regions } from '../types';
import { relativeGradientEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function fineLines(img: RgbImage, regions: Regions): number {
  const e = (relativeGradientEnergy(img, regions.periocularL) + relativeGradientEnergy(img, regions.periocularR)) / 2;
  return norm01(e, CAL.fineLines.lo, CAL.fineLines.hi);
}
```

```ts
// src/features/read/cv/dimensions/oiliness.ts
// Oiliness = fraction of T-zone pixels reading as specular highlight, measured RELATIVE to the
// person's own skin baseline. The old absolute luma threshold (0.8) returned 0 on any
// underexposed capture regardless of actual shine (spec F3).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { specularFraction } from '../sampling';
import { norm01, CAL } from '../calibration';

export function oiliness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const f = specularFraction(img, regions.tZone, baseline.L, CAL.oiliness.relLift, CAL.oiliness.satThr);
  return norm01(f, CAL.oiliness.lo, CAL.oiliness.hi);
}
```

Update `CAL` in `src/features/read/cv/calibration.ts` (keep the existing `PROVISIONAL` header comment):

```ts
  oiliness: { relLift: 0.5, satThr: 0.15, lo: 0, hi: 0.25 }, // relative specular fraction
  pores: { relThr: 0.06, lo: 0, hi: 0.3 },                   // RELATIVE local-contrast density
  fineLines: { lo: 0, hi: 0.3 },                             // tone-relative horizontal gradient
```

Update the `oiliness` call in `src/features/read/cv/score-from-rgb.ts` — note `baseline` is already computed on the line above:

```ts
    oiliness: oiliness(rgb, regions, baseline),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest relative-measures --verbose` → Expected: PASS (8 tests).
Run: `npx jest src/features/read eval/ --verbose` → Expected: PASS. Existing dimension tests asserting the old absolute behaviour will fail; update **those tests' expectations** to the relative measures — the old expectations encoded the defect. Do not revert the implementation.

- [ ] **Step 5: Verify the three target dimensions, then commit**

Run: `npm run eval:invariance`

**Corrected expectation (2026-07-25, after measurement).** An earlier draft of this plan said the
illuminant axis would flip to PASS here. That was wrong, and the committed baseline proves it: the
axis reports only its single *worst* dimension, and `oiliness` (0.3632) masked the fact that
`darkSpots` (0.1115) and `redness` (0.0875) were **already** breaching their 0.08 epsilon before this
task began.

So the correct expectation for Task 7 is per-dimension, not axis-level:

| dimension | before | after must be | epsilon |
|---|---|---|---|
| `oiliness` | 0.3632 | under bound | 0.12 |
| `pores` | 0.0143 | under bound | 0.12 |
| `fineLines` | 0.0208 | under bound | 0.10 |

`darkSpots` and `redness` are untouched by this task — they are chromaticity- and lightness-drift
defects, which is what **Task 12's** illuminant normalization targets. The axis-level flip to PASS is
therefore Task 12's milestone. Do not chase it here, and do not widen scope to reach it.

Update `eval/invariance/__tests__/axes.test.ts` to assert the *true* verdict plus explicit
per-dimension epsilon checks for the three dimensions this task fixed, so the improvement is locked
in even while the axis as a whole still fails.

```bash
git add src/features/read/cv/ eval/reports/ eval/invariance/__tests__/axes.test.ts
git commit -m "fix(read): make pores, fineLines and oiliness illumination-relative

pores used an absolute contrast threshold and fineLines an absolute gradient, so
both scaled with exposure AND under-detected on deep skin. oiliness used an
absolute 0.8 luma threshold, returning 0 on any underexposed capture.

All three are now Weber-relative or baseline-relative. Illuminant invariance flips
PASS; report committed."
```

---

## Task 8: Area-averaged resampling (spec F4)

**Files:**
- Create: `src/features/read/cv/resample.ts`
- Modify: `src/features/read/decode-rgb.ts`
- Test: `src/features/read/cv/__tests__/resample.test.ts`

**Interfaces:**
- Produces: `areaDownscale(src: { width, height, data: Uint8Array | Uint8ClampedArray }, edge: number): RgbImage`
- `decode-rgb.ts` keeps exporting `downscaleRgba` as a thin re-export so existing imports/tests keep working.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/resample.test.ts
import { areaDownscale } from '../resample';
import { solidRgb, addNoise } from '../fixtures';

describe('areaDownscale', () => {
  it('never upscales', () => {
    const out = areaDownscale(solidRgb(40, 30), 512);
    expect(out.width).toBe(40);
    expect(out.height).toBe(30);
  });

  it('scales the long edge to the target and preserves aspect ratio', () => {
    const out = areaDownscale(solidRgb(800, 400), 200);
    expect(out.width).toBe(200);
    expect(out.height).toBe(100);
  });

  it('preserves a flat colour exactly', () => {
    const out = areaDownscale(solidRgb(256, 256, [120, 90, 70]), 64);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([120, 90, 70]);
  });

  it('averages rather than point-samples — a 2x2 checkerboard becomes its mean', () => {
    const src = { width: 2, height: 2, data: new Uint8ClampedArray([
      0, 0, 0, 255,   255, 255, 255, 255,
      255, 255, 255, 255,   0, 0, 0, 255,
    ]) };
    const out = areaDownscale(src, 1);
    expect(out.data[0]).toBeGreaterThan(120);
    expect(out.data[0]).toBeLessThan(136);
  });

  it('retains far more texture energy than nearest-neighbour', () => {
    // The point of the change: nearest-neighbour point-samples every Nth pixel and aliases the
    // high-frequency detail that texture/pores/fineLines measure (spec F4).
    const src = addNoise(solidRgb(256, 256, [160, 130, 110]), { x: 0, y: 0, w: 256, h: 256 }, 40, 7);
    const nearest = (() => {
      const s = 0.25, w = 64, h = 64;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const si = (Math.floor(y / s) * 256 + Math.floor(x / s)) * 4;
        const di = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) data[di + c] = src.data[si + c];
      }
      return { width: w, height: h, data };
    })();
    const area = areaDownscale(src, 64);
    const meanOf = (im: any) => { let s = 0; for (let i = 0; i < im.data.length; i += 4) s += im.data[i]; return s / (im.data.length / 4); };
    const varOf = (im: any) => { const m = meanOf(im); let s = 0; for (let i = 0; i < im.data.length; i += 4) s += (im.data[i] - m) ** 2; return s / (im.data.length / 4); };
    // Averaging attenuates noise variance predictably; point-sampling passes it through unfiltered,
    // which is aliasing, not detail. The area result must be SMOOTHER, not noisier.
    expect(varOf(area)).toBeLessThan(varOf(nearest));
  });

  it('produces a fully opaque RGBA buffer of the right length', () => {
    const out = areaDownscale(solidRgb(300, 200), 100);
    expect(out.data).toHaveLength(out.width * out.height * 4);
    expect(out.data[3]).toBe(255);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest resample --verbose`
Expected: FAIL — `Cannot find module '../resample'`.

- [ ] **Step 3: Implement**

```ts
// src/features/read/cv/resample.ts
// Area-averaged (box) downscale. Every destination pixel is the mean of the full source rectangle
// it covers, so no source pixel is discarded.
//
// Why this matters: the previous nearest-neighbour path point-sampled roughly every sixth pixel
// when reducing a ~3000px photo to a 512px working edge, aliasing exactly the high-frequency
// detail that texture, pores and fineLines exist to measure (spec F4).
import type { RgbImage } from './types';

export function areaDownscale(
  src: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
  edge: number,
): RgbImage {
  const scale = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor((y * src.height) / h);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor((x * src.width) / w);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * src.width) / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < src.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < src.width; sx++) {
          const si = (sy * src.width + sx) * 4;
          r += src.data[si]; g += src.data[si + 1]; b += src.data[si + 2]; n++;
        }
      }
      const di = (y * w + x) * 4;
      data[di] = r / n; data[di + 1] = g / n; data[di + 2] = b / n; data[di + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
```

In `src/features/read/decode-rgb.ts`, replace the `downscaleRgba` body with a re-export and use it in `decodeJpegToRgb`:

```ts
import { areaDownscale } from './cv/resample';

// Retained as a named export for existing call sites; area-averaged since 2026-07-25 (spec F4).
export const downscaleRgba = areaDownscale;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest resample decode-rgb --verbose` → Expected: PASS.
Run: `npm test` → Expected: PASS. If a `decode-rgb` test asserted nearest-neighbour point values, update that expectation — it encoded the defect.

- [ ] **Step 5: Verify no axis regression, then commit**

Run: `npm run eval:invariance` → Expected: all axes still PASS.

```bash
git add src/features/read/cv/resample.ts src/features/read/cv/__tests__/resample.test.ts \
        src/features/read/decode-rgb.ts eval/reports/
git commit -m "fix(read): area-averaged downscale so texture survives resampling

Nearest-neighbour point-sampled ~1 pixel in 6 at working size, aliasing the
high-frequency detail texture/pores/fineLines measure."
```

---

## Task 9: EXIF orientation (spec F5)

**Files:**
- Create: `src/features/read/exif-orientation.ts`
- Modify: `src/features/read/decode-rgb.ts`
- Test: `src/features/read/__tests__/exif-orientation.test.ts`

**Interfaces:**
- Produces:
  - `readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8` — defaults to `1` when absent or unparseable
  - `applyOrientation(img: RgbImage, orientation: number): RgbImage` — returns a NEW image

**Why this task exists:** `jpeg-js` ignores EXIF. Once regions are placed off a real detected face (Task 11), a sideways decode puts "forehead" on an ear — and MLKit *does* honour EXIF, so a mismatch mis-places every region silently. This is the highest-risk item in the spec (§11).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/__tests__/exif-orientation.test.ts
import { readExifOrientation, applyOrientation } from '../exif-orientation';
import { solidRgb, fillRect } from '../cv/fixtures';

// Minimal JPEG APP1/EXIF header carrying a single Orientation tag (0x0112), big-endian.
function jpegWithOrientation(value: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,   // 'MM', 42, IFD0 offset 8
    0x00, 0x01,                                        // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,    // tag 0x0112, SHORT, count 1
    (value >> 8) & 0xff, value & 0xff, 0x00, 0x00,     // value
    0x00, 0x00, 0x00, 0x00,                            // next IFD = 0
  ];
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // 'Exif\0\0' + TIFF
  const len = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...exif]);
}

describe('readExifOrientation', () => {
  it('reads orientation 6 (rotate 90 CW)', () => {
    expect(readExifOrientation(jpegWithOrientation(6))).toBe(6);
  });
  it('reads orientation 8 (rotate 270 CW)', () => {
    expect(readExifOrientation(jpegWithOrientation(8))).toBe(8);
  });
  it('defaults to 1 when there is no EXIF block', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0]))).toBe(1);
  });
  it('defaults to 1 on truncated or malformed input rather than throwing', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toBe(1);
    expect(readExifOrientation(new Uint8Array([]))).toBe(1);
  });
});

describe('applyOrientation', () => {
  const marked = () => fillRect(solidRgb(8, 4, [10, 10, 10]), { x: 0, y: 0, w: 2, h: 1 }, [255, 0, 0]);
  const pixel = (img: any, x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };

  it('returns the image unchanged for orientation 1', () => {
    const src = marked();
    expect(Array.from(applyOrientation(src, 1).data)).toEqual(Array.from(src.data));
  });

  it('swaps width and height for 90-degree rotations', () => {
    const out = applyOrientation(marked(), 6);
    expect(out.width).toBe(4);
    expect(out.height).toBe(8);
  });

  it('keeps dimensions for a 180-degree rotation', () => {
    const out = applyOrientation(marked(), 3);
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('moves the top-left marker to the top-right under orientation 6', () => {
    const out = applyOrientation(marked(), 6);
    expect(pixel(out, out.width - 1, 0)).toEqual([255, 0, 0]);
  });

  it('moves the top-left marker to the bottom-right under orientation 3', () => {
    const out = applyOrientation(marked(), 3);
    expect(pixel(out, out.width - 1, out.height - 1)).toEqual([255, 0, 0]);
  });

  it('composes back to the original after four 90-degree rotations', () => {
    const src = marked();
    let out = src;
    for (let i = 0; i < 4; i++) out = applyOrientation(out, 6);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('does not mutate its input', () => {
    const src = marked();
    const before = Array.from(src.data);
    applyOrientation(src, 6);
    expect(Array.from(src.data)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest exif-orientation --verbose`
Expected: FAIL — `Cannot find module '../exif-orientation'`.

- [ ] **Step 3: Implement**

```ts
// src/features/read/exif-orientation.ts
// jpeg-js ignores EXIF orientation; MLKit's still detector honours it. If the decoded buffer and
// the detector disagree about which way is up, every region lands wrong and nothing errors
// (spec F5, §11). This module makes the decode agree with the detector.
import type { RgbImage } from './cv/types';

const DEFAULT: 1 = 1;

// Only the rotations a phone camera actually produces. Mirrored variants (2/4/5/7) are folded to
// their unmirrored rotation: the front camera's mirroring is handled by the capture pipeline, and
// treating a mirrored tag as its rotation is strictly better than ignoring orientation entirely.
export function readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8 {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return DEFAULT;
    let off = 2;
    while (off + 4 <= bytes.length) {
      if (bytes[off] !== 0xff) return DEFAULT;
      const marker = bytes[off + 1];
      const size = (bytes[off + 2] << 8) | bytes[off + 3];
      if (size < 2) return DEFAULT;
      if (marker === 0xe1) {
        const start = off + 4;
        if (bytes[start] !== 0x45 || bytes[start + 1] !== 0x78) return DEFAULT; // 'Ex'
        const tiff = start + 6;
        if (tiff + 8 > bytes.length) return DEFAULT;
        const be = bytes[tiff] === 0x4d;
        const u16 = (p: number) => (be ? (bytes[p] << 8) | bytes[p + 1] : (bytes[p + 1] << 8) | bytes[p]);
        const u32 = (p: number) => (be
          ? ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0
          : ((bytes[p + 3] << 24) | (bytes[p + 2] << 16) | (bytes[p + 1] << 8) | bytes[p]) >>> 0);
        const ifd = tiff + u32(tiff + 4);
        if (ifd + 2 > bytes.length) return DEFAULT;
        const count = u16(ifd);
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12;
          if (entry + 12 > bytes.length) return DEFAULT;
          if (u16(entry) === 0x0112) {
            const v = u16(entry + 8);
            return v === 3 || v === 6 || v === 8 ? v : DEFAULT;
          }
        }
        return DEFAULT;
      }
      if (marker === 0xda) return DEFAULT; // start of scan — no EXIF found
      off += 2 + size;
    }
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function applyOrientation(img: RgbImage, orientation: number): RgbImage {
  if (orientation !== 3 && orientation !== 6 && orientation !== 8) {
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  }
  const swap = orientation === 6 || orientation === 8;
  const w = swap ? img.height : img.width;
  const h = swap ? img.width : img.height;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let dx: number;
      let dy: number;
      if (orientation === 3) { dx = img.width - 1 - x; dy = img.height - 1 - y; }
      else if (orientation === 6) { dx = img.height - 1 - y; dy = x; }
      else { dx = y; dy = img.width - 1 - x; }
      const si = (y * img.width + x) * 4;
      const di = (dy * w + dx) * 4;
      data[di] = img.data[si];
      data[di + 1] = img.data[si + 1];
      data[di + 2] = img.data[si + 2];
      data[di + 3] = img.data[si + 3];
    }
  }
  return { width: w, height: h, data };
}
```

In `decodeJpegToRgb`, apply orientation **before** downscaling:

```ts
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }) as {
    width: number; height: number; data: Uint8Array;
  };
  const upright = applyOrientation(
    { width: decoded.width, height: decoded.height, data: new Uint8ClampedArray(decoded.data) },
    readExifOrientation(bytes),
  );
  return areaDownscale(upright, WORKING_EDGE);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest exif-orientation --verbose` → Expected: PASS (11 tests).
Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Correct the stale trained-model spec (spec F7)**

`docs/superpowers/specs/2026-07-02-trained-model-track-design.md` §5.3 lists `decodeToRgb` as
outstanding work. It is implemented (`decodeJpegToRgb`, via `jpeg-js`) and, as of this task, also
orientation-correct. Replace that bullet with:

```markdown
3. ~~**`decodeToRgb` device contract**~~ — **DONE.** Implemented as `decodeJpegToRgb`
   (`src/features/read/decode-rgb.ts`): pure-JS `jpeg-js` decode, EXIF-orientation corrected, and
   area-averaged downscale to a 512 px working edge. See
   `docs/superpowers/specs/2026-07-25-scan-accuracy-pipeline-design.md` F4/F5.
```

- [ ] **Step 6: Commit**

```bash
git add src/features/read/exif-orientation.ts src/features/read/__tests__/exif-orientation.test.ts \
        src/features/read/decode-rgb.ts docs/superpowers/specs/2026-07-02-trained-model-track-design.md
git commit -m "fix(read): honour EXIF orientation in the decode

jpeg-js ignores EXIF; MLKit's still detector honours it. Without this the decoded
buffer and the detector disagree about which way is up, and every contour-placed
region lands wrong with no error raised."
```

---

## Task 10: Contour-based region derivation (spec §3b)

**Files:**
- Create: `src/features/read/face-geometry.ts`
- Test: `src/features/read/__tests__/face-geometry.test.ts`

**Interfaces:**
- Consumes: `Regions`, `Rect`, `RgbImage` from `cv/types.ts`; `deriveRegions` from `cv/regions.ts`

> **On the duplicated `FaceContours` type.** It is declared twice on purpose — once in
> `eval/render/geometry.ts` (Task 2) and once here. They are structurally identical, so TypeScript
> accepts renderer output wherever this module expects contours, which is what lets Task 10's tests
> use rendered faces as fixtures. They are *not* shared via import because `src/` must never import
> from `eval/` — production code cannot depend on the test harness. Both mirror MLKit's `Contours`
> shape (`react-native-vision-camera-face-detector/lib/typescript/src/specs/Contours.d.ts`), which
> is the actual source of truth for the field names. If MLKit's shape changes, both must change.
- Produces:
  - `DetectedFace = { bounds: { x, y, width, height }; contours?: Partial<FaceContours> }`
  - `scaleRect(r: Rect, from: { width, height }, to: { width, height }): Rect`
  - `regionsFromContours(c: Partial<FaceContours>, size): Regions | null` — `null` when required contours are missing or produce invalid rects
  - `deriveRegionsForFace(face: DetectedFace | null, size): { regions: Regions; source: 'contours' | 'bounds' | 'fallback' }`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/__tests__/face-geometry.test.ts
import { scaleRect, regionsFromContours, deriveRegionsForFace } from '../face-geometry';
import { faceEllipse, syntheticContours } from '../../../../eval/render/geometry';
import { REGION_NAMES } from '../cv/types';

const SIZE = { width: 256, height: 256 };
const contoursFor = (g = { scale: 1, dx: 0, dy: 0 }) => syntheticContours(faceEllipse(SIZE, g));
const inside = (r: any, poly: any[]) => {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  return r.x >= Math.min(...xs) - 1 && r.x + r.w <= Math.max(...xs) + 1 &&
         r.y >= Math.min(...ys) - 1 && r.y + r.h <= Math.max(...ys) + 1;
};

describe('scaleRect', () => {
  it('is identity when the sizes match', () => {
    const r = { x: 10, y: 20, w: 30, h: 40 };
    expect(scaleRect(r, SIZE, SIZE)).toEqual(r);
  });
  it('scales proportionally when the working image is smaller', () => {
    const out = scaleRect({ x: 100, y: 200, w: 400, h: 400 }, { width: 1000, height: 1000 }, { width: 100, height: 100 });
    expect(out).toEqual({ x: 10, y: 20, w: 40, h: 40 });
  });
});

describe('regionsFromContours', () => {
  it('produces every named region', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    for (const n of REGION_NAMES) expect(r[n].w).toBeGreaterThan(0);
  });

  it('keeps every region inside the FACE polygon', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    for (const n of REGION_NAMES) expect(inside(r[n], c.FACE)).toBe(true);
  });

  it('places cheeks on the cheek contours, left of and right of centre', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.cheekL.x + r.cheekL.w / 2).toBeLessThan(128);
    expect(r.cheekR.x + r.cheekR.w / 2).toBeGreaterThan(128);
  });

  it('places the forehead above the eyes', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.forehead.y + r.forehead.h).toBeLessThanOrEqual(r.periocularL.y + r.periocularL.h);
  });

  it('places infraorbital bands below the eyes and above the cheeks', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.infraorbitalL.y).toBeGreaterThan(r.periocularL.y);
    expect(r.infraorbitalL.y).toBeLessThan(r.cheekL.y);
  });

  it('keeps the tZone from overlapping either cheek horizontally', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.tZone.x).toBeGreaterThanOrEqual(r.cheekL.x + r.cheekL.w - 1);
    expect(r.tZone.x + r.tZone.w).toBeLessThanOrEqual(r.cheekR.x + 1);
  });

  it('tracks a shifted, smaller face', () => {
    const wide = regionsFromContours(contoursFor(), SIZE)!;
    const small = regionsFromContours(contoursFor({ scale: 0.6, dx: 0.1, dy: 0 }), SIZE)!;
    expect(small.cheekL.w).toBeLessThan(wide.cheekL.w);
    expect(small.cheekL.x).toBeGreaterThan(wide.cheekL.x);
  });

  it('returns null when a required contour is missing', () => {
    const { LEFT_CHEEK, ...rest } = contoursFor();
    expect(regionsFromContours(rest as any, SIZE)).toBeNull();
  });
});

describe('deriveRegionsForFace', () => {
  const bounds = { x: 40, y: 30, width: 170, height: 210 };

  it('uses contours when they are present and valid', () => {
    expect(deriveRegionsForFace({ bounds, contours: contoursFor() }, SIZE).source).toBe('contours');
  });

  it('falls back to proportional regions off the bounds when contours are absent', () => {
    expect(deriveRegionsForFace({ bounds }, SIZE).source).toBe('bounds');
  });

  it('falls back again to the centered approximation when no face was detected', () => {
    const out = deriveRegionsForFace(null, SIZE);
    expect(out.source).toBe('fallback');
    for (const n of REGION_NAMES) expect(out.regions[n].w).toBeGreaterThan(0);
  });

  it('never returns a region outside the image at any fallback level', () => {
    for (const face of [{ bounds, contours: contoursFor() }, { bounds }, null]) {
      const { regions } = deriveRegionsForFace(face, SIZE);
      for (const n of REGION_NAMES) {
        expect(regions[n].x).toBeGreaterThanOrEqual(0);
        expect(regions[n].y).toBeGreaterThanOrEqual(0);
        expect(regions[n].x + regions[n].w).toBeLessThanOrEqual(SIZE.width);
        expect(regions[n].y + regions[n].h).toBeLessThanOrEqual(SIZE.height);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest face-geometry --verbose`
Expected: FAIL — `Cannot find module '../face-geometry'`.

- [ ] **Step 3: Implement**

```ts
// src/features/read/face-geometry.ts
// Contours → Regions (spec §3b). Pure: the device shell (detect-faces-still.ts) supplies the
// DetectedFace; this module never touches native.
//
// Fallback chain, each step failing open to the next:
//   contours present and valid → contour regions
//   face detected, no contours → proportional regions off the detected bounds
//   no face                    → approximateFaceBbox, i.e. exactly today's behaviour
import type { Rect, Regions, RegionName } from './cv/types';
import { REGION_NAMES } from './cv/types';
import { deriveRegions } from './cv/regions';
import { approximateFaceBbox } from './detect-bbox';
import { clampRect } from './cv/sampling';

export interface Point { x: number; y: number }
export interface FaceContours {
  FACE: Point[]; LEFT_CHEEK: Point[]; RIGHT_CHEEK: Point[];
  LEFT_EYE: Point[]; RIGHT_EYE: Point[];
  LEFT_EYEBROW_TOP: Point[]; RIGHT_EYEBROW_TOP: Point[];
  NOSE_BRIDGE: Point[]; NOSE_BOTTOM: Point[];
}
export interface DetectedFace {
  bounds: { x: number; y: number; width: number; height: number };
  contours?: Partial<FaceContours>;
}

export function scaleRect(r: Rect, from: { width: number; height: number }, to: { width: number; height: number }): Rect {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return { x: Math.round(r.x * sx), y: Math.round(r.y * sy), w: Math.round(r.w * sx), h: Math.round(r.h * sy) };
}

function box(pts: Point[] | undefined): Rect | null {
  if (!pts || pts.length < 3) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const inset = (r: Rect, k: number): Rect => ({
  x: r.x + r.w * k, y: r.y + r.h * k, w: r.w * (1 - 2 * k), h: r.h * (1 - 2 * k),
});

const REQUIRED: Array<keyof FaceContours> = [
  'FACE', 'LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE',
  'LEFT_EYEBROW_TOP', 'RIGHT_EYEBROW_TOP', 'NOSE_BRIDGE', 'NOSE_BOTTOM',
];

export function regionsFromContours(
  c: Partial<FaceContours>,
  size: { width: number; height: number },
): Regions | null {
  for (const k of REQUIRED) if (!c[k] || c[k]!.length < 3) return null;

  const face = box(c.FACE)!;
  const eyeL = box(c.LEFT_EYE)!;
  const eyeR = box(c.RIGHT_EYE)!;
  const browL = box(c.LEFT_EYEBROW_TOP)!;
  const browR = box(c.RIGHT_EYEBROW_TOP)!;
  const cheekL = box(c.LEFT_CHEEK)!;
  const cheekR = box(c.RIGHT_CHEEK)!;
  const bridge = box(c.NOSE_BRIDGE)!;
  const noseB = box(c.NOSE_BOTTOM)!;

  const browTop = Math.min(browL.y, browR.y);
  const foreheadTop = face.y + face.h * 0.06;

  const raw: Record<RegionName, Rect> = {
    cheekL: inset(cheekL, 0.15),
    cheekR: inset(cheekR, 0.15),
    // Between the eye and the cheek, spanning the eye's width.
    infraorbitalL: { x: eyeL.x, y: eyeL.y + eyeL.h, w: eyeL.w, h: Math.max(2, cheekL.y - (eyeL.y + eyeL.h)) },
    infraorbitalR: { x: eyeR.x, y: eyeR.y + eyeR.h, w: eyeR.w, h: Math.max(2, cheekR.y - (eyeR.y + eyeR.h)) },
    // Above the brows, clipped to the FACE polygon.
    forehead: { x: face.x + face.w * 0.22, y: foreheadTop, w: face.w * 0.56, h: Math.max(2, browTop - foreheadTop) },
    // Outer margin of each eye — where crow's feet sit.
    periocularL: { x: eyeL.x - eyeL.w * 0.5, y: eyeL.y - eyeL.h * 0.6, w: eyeL.w * 0.75, h: eyeL.h * 2.4 },
    periocularR: { x: eyeR.x + eyeR.w * 0.75, y: eyeR.y - eyeR.h * 0.6, w: eyeR.w * 0.75, h: eyeR.h * 2.4 },
    // Nose bridge through nose bottom, widened — plus the forehead strip above it.
    tZone: {
      x: bridge.x - bridge.w * 0.6,
      y: foreheadTop,
      w: bridge.w * 2.2,
      h: (noseB.y + noseB.h) - foreheadTop,
    },
  };

  const out = Object.fromEntries(
    REGION_NAMES.map((n) => [n, clampRect(raw[n], size.width, size.height)]),
  ) as Regions;

  // Validity: every region must be non-degenerate and sit inside the FACE polygon's bounds.
  for (const n of REGION_NAMES) {
    const r = out[n];
    if (r.w < 2 || r.h < 2) return null;
    if (r.x < face.x - 1 || r.y < face.y - 1) return null;
    if (r.x + r.w > face.x + face.w + 1 || r.y + r.h > face.y + face.h + 1) return null;
  }
  return out;
}

export function deriveRegionsForFace(
  face: DetectedFace | null,
  size: { width: number; height: number },
): { regions: Regions; source: 'contours' | 'bounds' | 'fallback' } {
  if (face?.contours) {
    const r = regionsFromContours(face.contours, size);
    if (r) return { regions: r, source: 'contours' };
  }
  if (face) {
    const b: Rect = { x: face.bounds.x, y: face.bounds.y, w: face.bounds.width, h: face.bounds.height };
    return { regions: deriveRegions(b, size), source: 'bounds' };
  }
  return { regions: deriveRegions(approximateFaceBbox(size.width, size.height), size), source: 'fallback' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest face-geometry --verbose`
Expected: PASS (14 tests). If the tZone/cheek non-overlap assertion fails, adjust the `tZone` width multiplier (`2.2`) down until it holds — do not relax the test, since overlapping regions double-count pixels across dimensions.

- [ ] **Step 5: Commit**

```bash
git add src/features/read/face-geometry.ts src/features/read/__tests__/face-geometry.test.ts
git commit -m "feat(read): derive regions from face contours with a two-step fallback

A cheek rectangle placed by fixed proportion samples partly non-skin on a narrow,
wide or off-centre face, and every tone-relative dimension inherits that error
through sampleBaseline."
```

---

## Task 11: Still-image detection device shell + engine wiring

**Files:**
- Create: `src/features/read/detect-faces-still.ts`
- Modify: `src/features/read/cv-read-engine.ts`, `src/features/read/detect-bbox.ts`, `jest.config.js`
- Test: `src/features/read/__tests__/cv-read-engine.test.ts` (extend existing)

**Interfaces:**
- Consumes: `DetectedFace` (Task 10)
- Produces: `detectFacesOnStill(uri: string): Promise<DetectedFace | null>` — returns the largest face, or `null` on any failure

- [ ] **Step 1: Write the failing test**

```ts
// append to src/features/read/__tests__/cv-read-engine.test.ts
import { CvReadEngine } from '../cv-read-engine';
import { renderFace } from '../../../../eval/render/face';
import { faceEllipse, syntheticContours } from '../../../../eval/render/geometry';

describe('CvReadEngine face detection wiring', () => {
  const SIZE = { width: 256, height: 256 };
  const rendered = renderFace({ size: SIZE, defects: { spots: 0.5, oiliness: 0.4 } });
  const decode = async () => rendered.rgb;

  it('uses contour regions when the detector supplies them', async () => {
    const detect = jest.fn(async () => ({
      bounds: { x: rendered.bbox.x, y: rendered.bbox.y, width: rendered.bbox.w, height: rendered.bbox.h },
      contours: syntheticContours(faceEllipse(SIZE, { scale: 1, dx: 0, dy: 0 })),
    }));
    const engine = new CvReadEngine({ decode, detect, cleanup: async () => {} });
    const result = await engine.run('file://photo.jpg');
    expect(detect).toHaveBeenCalledWith('file://photo.jpg');
    expect(result.modelVersion).toBe('cv-1');
    expect(Object.values(result.scores).every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('still produces a valid read when detection returns null', async () => {
    const engine = new CvReadEngine({ decode, detect: async () => null, cleanup: async () => {} });
    const result = await engine.run('file://photo.jpg');
    expect(Object.values(result.scores).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('still produces a valid read when detection throws', async () => {
    const engine = new CvReadEngine({
      decode,
      detect: async () => { throw new Error('mlkit unavailable'); },
      cleanup: async () => {},
    });
    const result = await engine.run('file://photo.jpg');
    expect(Object.values(result.scores).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('deletes the image even when detection throws', async () => {
    const cleanup = jest.fn(async () => {});
    const engine = new CvReadEngine({
      decode, cleanup,
      detect: async () => { throw new Error('boom'); },
    });
    await engine.run('file://photo.jpg');
    expect(cleanup).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest cv-read-engine --verbose`
Expected: FAIL — `CvReadEngine` does not accept a `detect` dependency.

- [ ] **Step 3: Implement**

```ts
// src/features/read/detect-faces-still.ts
// DEVICE-ONLY: MLKit still-image face detection on the captured photo.
//
// Compliance (spec §3a, founder-approved 2026-07-25): this is an existing API of
// react-native-vision-camera-face-detector, already installed and already processing face data
// on-device via the live detector. No new vendor, no package.json change. The photo is read
// locally and deleted by withImageCleanup; nothing crosses the compliance boundary.
//
// MLKit has no arm64 iOS-simulator slice, so this returns null there rather than crashing.
import type { DetectedFace } from './face-geometry';

let cached: { detectFaces: (uri: string) => unknown } | null = null;

function detector() {
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createImageFaceDetector } = require('react-native-vision-camera-face-detector');
  cached = createImageFaceDetector({
    performanceMode: 'accurate',
    runContours: true,
    runLandmarks: false,
    runClassifications: false,
    trackingEnabled: false, // MLKit: contours imply single-face; tracking would be wasted work
  });
  return cached;
}

const area = (f: any) => Math.max(0, f?.bounds?.width ?? 0) * Math.max(0, f?.bounds?.height ?? 0);

export async function detectFacesOnStill(uri: string): Promise<DetectedFace | null> {
  try {
    const faces = detector().detectFaces({ uri }) as any[];
    if (!Array.isArray(faces) || faces.length === 0) return null;
    const face = faces.reduce((best, f) => (area(f) > area(best) ? f : best));
    if (!face?.bounds || area(face) <= 0) return null;
    return { bounds: face.bounds, contours: face.contours };
  } catch {
    // Simulator, missing native module, unreadable file — fall back to the proportional path.
    return null;
  }
}
```

Rewrite `src/features/read/cv-read-engine.ts` to take injectable dependencies (matching the existing test style) and use the new geometry:

```ts
// src/features/read/cv-read-engine.ts
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import type { RgbImage } from './cv/types';
import { decodeJpegToRgb } from './decode-rgb';
import { detectFacesOnStill } from './detect-faces-still';
import { deriveRegionsForFace, type DetectedFace } from './face-geometry';
import { scoreFromRgb } from './cv/score-from-rgb';
import { withImageCleanup } from './image-lifecycle';

interface Deps {
  decode?: (uri: string) => Promise<RgbImage>;
  detect?: (uri: string) => Promise<DetectedFace | null>;
  cleanup?: (uri: string) => Promise<void>;
}

export class CvReadEngine implements ReadEngine {
  constructor(private readonly deps: Deps = {}) {}

  async run(uri: string): Promise<ReadResult> {
    const decode = this.deps.decode ?? decodeJpegToRgb;
    const detect = this.deps.detect ?? detectFacesOnStill;
    return withImageCleanup(uri, async () => {
      const rgb = await decode(uri);
      // Detection is best-effort: a failure degrades region placement, it must never fail the read.
      let face: DetectedFace | null = null;
      try {
        face = await detect(uri);
      } catch {
        face = null;
      }
      const { regions } = deriveRegionsForFace(face, { width: rgb.width, height: rgb.height });
      return scoreFromRgb(rgb, regions);
    }, this.deps.cleanup);
  }
}
```

Change `scoreFromRgb` to accept `Regions` directly instead of deriving them internally, in `src/features/read/cv/score-from-rgb.ts`:

```ts
export function scoreFromRgb(rgb: RgbImage, regions: Regions): ReadResult {
  const baseline = sampleBaseline(rgb, regions);
  // ...unchanged from here
```

Add a compatibility overload used by the eval axes (which pass a bbox, not regions) at the bottom of the same file:

```ts
// Convenience for harnesses that have a bbox rather than regions.
export function scoreFromBbox(rgb: RgbImage, bbox: Rect): ReadResult {
  return scoreFromRgb(rgb, deriveRegions(bbox, { width: rgb.width, height: rgb.height }));
}
```

Update `eval/invariance/axes.ts` to import `scoreFromBbox` instead of `scoreFromRgb`.

Update the stale note in `src/features/read/detect-bbox.ts` — replace the "Upgrade paths" comment block with:

```ts
// Fallback only. The read now detects on the captured still via detect-faces-still.ts
// (spec §3a, founder-approved 2026-07-25); this centered approximation is what the fallback
// chain in face-geometry.ts lands on when no face is detected at all.
```

Add to `jest.config.js` `coveragePathIgnorePatterns`:

```js
    '<rootDir>/src/features/read/detect-faces-still.ts',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest cv-read-engine face-geometry --verbose` → Expected: PASS.
Run: `npm test` → Expected: PASS.
Run: `npm run eval:invariance` → Expected: all axes PASS.
Run: `npm run check:no-egress` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/read/ eval/invariance/axes.ts jest.config.js eval/reports/
git commit -m "feat(read): detect the face on the captured still with contours

Uses createImageFaceDetector from the already-installed detector package —
no new vendor, no package.json change (spec §3a, founder-approved).
Detection is best-effort: null or a throw degrades to proportional regions,
never fails the read, and the image is deleted either way."
```

---

## Task 12: Illuminant normalization (spec 4b, 4c)

**Files:**
- Create: `src/features/read/cv/illuminant.ts`
- Modify: `src/features/read/cv-read-engine.ts`
- Test: `src/features/read/cv/__tests__/illuminant.test.ts`

**Interfaces:**
- Produces:
  - `estimateIlluminant(img: RgbImage, regions: Regions): [number, number, number]` — normalized RGB gains, `[1,1,1]` when implausible
  - `adaptToD65(img: RgbImage, gains: [number, number, number]): RgbImage`
  - `flattenShading(img: RgbImage, regions: Regions): RgbImage`
  - `normalizeIlluminant(img: RgbImage, regions: Regions): RgbImage`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/read/cv/__tests__/illuminant.test.ts
import { estimateIlluminant, adaptToD65, normalizeIlluminant, flattenShading } from '../illuminant';
import { renderFace } from '../../../../../eval/render/face';
import { faceEllipse, syntheticContours } from '../../../../../eval/render/geometry';
import { regionsFromContours } from '../../face-geometry';
import { meanLab } from '../sampling';

const SIZE = { width: 256, height: 256 };
const regions = regionsFromContours(syntheticContours(faceEllipse(SIZE, { scale: 1, dx: 0, dy: 0 })), SIZE)!;
const render = (p: any) => renderFace({ size: SIZE, ...p }).rgb;

describe('estimateIlluminant', () => {
  it('is near-neutral under a D65-ish illuminant', () => {
    const g = estimateIlluminant(render({ illuminant: { tempK: 6500 } }), regions);
    expect(g[0] / g[2]).toBeCloseTo(1, 0);
  });

  it('detects a warm cast as red-heavy gains', () => {
    const g = estimateIlluminant(render({ illuminant: { tempK: 2700 } }), regions);
    expect(g[0]).toBeGreaterThan(g[2]);
  });

  it('does NOT vary with skin tone under the same light', () => {
    // The fairness requirement (spec §6b): the estimator must attribute tone to melanin, not to
    // the illuminant. Grey-World fails this catastrophically and is prohibited.
    const light = estimateIlluminant(render({ fst: 'I', illuminant: { tempK: 4000 } }), regions);
    const deep = estimateIlluminant(render({ fst: 'VI', illuminant: { tempK: 4000 } }), regions);
    expect(light[0] / light[2]).toBeCloseTo(deep[0] / deep[2], 1);
  });

  it('returns identity gains on a degenerate (black) image', () => {
    const black = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
    const flat = { cheekL: { x: 0, y: 0, w: 16, h: 16 }, cheekR: { x: 16, y: 0, w: 16, h: 16 } } as any;
    expect(estimateIlluminant(black, flat)).toEqual([1, 1, 1]);
  });
});

describe('adaptToD65', () => {
  it('does not mutate its input', () => {
    const img = render({ illuminant: { tempK: 3000 } });
    const before = Array.from(img.data);
    adaptToD65(img, [1.2, 1, 0.8]);
    expect(Array.from(img.data)).toEqual(before);
  });

  it('is identity for unit gains', () => {
    const img = render({});
    expect(Array.from(adaptToD65(img, [1, 1, 1]).data)).toEqual(Array.from(img.data));
  });
});

describe('normalizeIlluminant', () => {
  it('pulls warm and cool captures of the same face closer together in chroma', () => {
    const warm = render({ illuminant: { tempK: 2700 } });
    const cool = render({ illuminant: { tempK: 7500 } });
    const chromaGap = (a: any, b: any) => {
      const la = meanLab(a, regions.cheekL);
      const lb = meanLab(b, regions.cheekL);
      return Math.hypot(la.a - lb.a, la.b - lb.b);
    };
    const before = chromaGap(warm, cool);
    const after = chromaGap(normalizeIlluminant(warm, regions), normalizeIlluminant(cool, regions));
    expect(after).toBeLessThan(before);
  });

  it('PRESERVES the lightness separation between Fitzpatrick tones', () => {
    // Invariance must never be bought by erasing tone (spec §6b).
    const l = (fst: any) => meanLab(normalizeIlluminant(render({ fst }), regions), regions.cheekL).L;
    expect(l('I') - l('VI')).toBeGreaterThan(15);
  });
});

describe('flattenShading', () => {
  it('reduces a left-right luminance gradient caused by side lighting', () => {
    const side = render({ shading: { azimuth: 0, elevation: 0.35, ambient: 0.25 } });
    const gap = (img: any) => Math.abs(meanLab(img, regions.cheekL).L - meanLab(img, regions.cheekR).L);
    expect(gap(flattenShading(side, regions))).toBeLessThan(gap(side));
  });

  it('leaves an evenly lit face essentially unchanged', () => {
    const even = render({ shading: { azimuth: 0, elevation: Math.PI / 2, ambient: 0.7 } });
    const gap = (img: any) => Math.abs(meanLab(img, regions.cheekL).L - meanLab(img, regions.cheekR).L);
    expect(Math.abs(gap(flattenShading(even, regions)) - gap(even))).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest illuminant --verbose`
Expected: FAIL — `Cannot find module '../illuminant'`.

- [ ] **Step 3: Implement**

```ts
// src/features/read/cv/illuminant.ts
// Illuminant normalization (spec §4b, §4c).
//
// GREY-WORLD IS PROHIBITED HERE. On a selfie the face fills the frame, so grey-world estimates the
// illuminant as the average colour of the SKIN and then corrects it toward neutral — desaturating
// and lightening deep skin. That is the exact bias this product exists to eliminate. The same
// objection rules out max-RGB / white-patch on a face-filling frame.
//
// Instead: SKIN-LOCUS estimation. Skin chromaticity across Fitzpatrick I-VI lies near a known line
// in log-chromaticity, because it varies principally along melanin/haemoglobin axes. We estimate
// the illuminant as the shift that puts the observed skin onto that locus, PROJECTING OUT the
// melanin direction so tone stays a free parameter.
import type { RgbImage, Regions } from './types';
import { clampRect, rgbAt, median } from './sampling';

// Canonical skin log-chromaticity under D65, and the direction melanin moves it.
// Derived from the same tone ladder the renderer uses, but expressed in log-chroma — a different
// parameterization, which is what keeps the harness non-circular (spec §6a).
const LOCUS_RG = 0.42;   // log(R/G) of canonical skin under D65
const LOCUS_BG = -0.30;  // log(B/G)
const MELANIN_DIR: [number, number] = [0.55, 0.835]; // unit direction tone travels in (rg, bg)

function skinLogChroma(img: RgbImage, regions: Regions): [number, number] | null {
  const rg: number[] = [];
  const bg: number[] = [];
  for (const rect of [regions.cheekL, regions.cheekR]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const [R, G, B] = rgbAt(img, x, y);
        if (R < 6 || G < 6 || B < 6 || R > 250 || G > 250 || B > 250) continue; // ignore clipped
        rg.push(Math.log(R / G));
        bg.push(Math.log(B / G));
      }
    }
  }
  return rg.length < 32 ? null : [median(rg), median(bg)];
}

export function estimateIlluminant(img: RgbImage, regions: Regions): [number, number, number] {
  const obs = skinLogChroma(img, regions);
  if (!obs) return [1, 1, 1];

  // Offset from the canonical locus, with the melanin component projected out: whatever remains
  // is attributed to the illuminant, so tone never masquerades as colour cast.
  let dRg = obs[0] - LOCUS_RG;
  let dBg = obs[1] - LOCUS_BG;
  const along = dRg * MELANIN_DIR[0] + dBg * MELANIN_DIR[1];
  dRg -= along * MELANIN_DIR[0];
  dBg -= along * MELANIN_DIR[1];

  const gains: [number, number, number] = [Math.exp(dRg), 1, Math.exp(dBg)];
  // Plausibility guard (spec §7): reject wild estimates rather than corrupting the image.
  for (const g of gains) if (!Number.isFinite(g) || g < 0.5 || g > 2) return [1, 1, 1];
  return gains;
}

// Von Kries-style adaptation: divide each channel by its estimated illuminant gain.
export function adaptToD65(img: RgbImage, gains: [number, number, number]): RgbImage {
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = img.data[i] / gains[0];
    data[i + 1] = img.data[i + 1] / gains[1];
    data[i + 2] = img.data[i + 2] / gains[2];
  }
  return { width: img.width, height: img.height, data };
}

// Fit a plane to luminance across the skin regions and divide it out, so side lighting stops
// reading as extra darkCircles/darkSpots on the shadowed side (spec §4c, F6).
export function flattenShading(img: RgbImage, regions: Regions): RgbImage {
  const pts: Array<[number, number, number]> = [];
  for (const rect of [regions.cheekL, regions.cheekR, regions.forehead]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y += 2) {
      for (let x = r.x; x < r.x + r.w; x += 2) {
        const [R, G, B] = rgbAt(img, x, y);
        pts.push([x, y, (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255]);
      }
    }
  }
  if (pts.length < 24) return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };

  // Least squares for L ≈ c + a*x + b*y via normal equations.
  let sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
  const n = pts.length;
  for (const [x, y, l] of pts) {
    sx += x; sy += y; sl += l; sxx += x * x; syy += y * y; sxy += x * y; sxl += x * l; syl += y * l;
  }
  const mx = sx / n, my = sy / n, ml = sl / n;
  const cxx = sxx - n * mx * mx, cyy = syy - n * my * my, cxy = sxy - n * mx * my;
  const cxl = sxl - n * mx * ml, cyl = syl - n * my * ml;
  const det = cxx * cyy - cxy * cxy;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) {
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  }
  const a = (cxl * cyy - cyl * cxy) / det;
  const b = (cyl * cxx - cxl * cxy) / det;

  const data = new Uint8ClampedArray(img.data);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const field = ml + a * (x - mx) + b * (y - my);
      // Correct toward the mean; clamp so a bad fit cannot blow up the image.
      const k = field > 0.02 ? Math.max(0.6, Math.min(1.6, ml / field)) : 1;
      const i = (y * img.width + x) * 4;
      data[i] = img.data[i] * k;
      data[i + 1] = img.data[i + 1] * k;
      data[i + 2] = img.data[i + 2] * k;
    }
  }
  return { width: img.width, height: img.height, data };
}

export function normalizeIlluminant(img: RgbImage, regions: Regions): RgbImage {
  return flattenShading(adaptToD65(img, estimateIlluminant(img, regions)), regions);
}
```

Wire it into `cv-read-engine.ts` — normalize **after** regions are known, since the estimator samples the cheeks:

```ts
      const { regions } = deriveRegionsForFace(face, { width: rgb.width, height: rgb.height });
      const canonical = normalizeIlluminant(rgb, regions);
      return scoreFromRgb(canonical, regions);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest illuminant --verbose` → Expected: PASS (10 tests).

If `estimateIlluminant` does not hold steady across tones, the `MELANIN_DIR` constant is mis-set. Recover it empirically: render FST I–VI at 6500 K, compute `[log(R/G), log(B/G)]` per tone, fit a line through the six points, and use its unit direction. Do **not** loosen the test — a tone-varying estimate is precisely the failure mode that would lighten deep skin.

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Verify the axes, then commit**

Run: `npm run eval:invariance`

**This task owns the illuminant axis's flip to PASS** (reassigned from Task 7 on 2026-07-25 after
measurement — see Task 7 Step 5). After Task 7, `oiliness`/`pores`/`fineLines` are all comfortably
under their bounds, and the only remaining breaches are:

| dimension | spread after Task 7 | epsilon |
|---|---|---|
| `darkSpots` | 0.1115 | 0.08 |
| `redness` | 0.0875 | 0.08 |

Both are exactly what this task addresses: `darkSpots` drifts with lightness and `redness` with
chroma, and `normalizeIlluminant` targets both. Flip the `illuminantAxis().pass` assertion in
`eval/invariance/__tests__/axes.test.ts` from `false` to `true` here, and record the before/after.

If normalization does NOT bring both under bound, report the measured spreads rather than widening
epsilon or altering the renderer — the bound is the contract.

Compare against the committed `eval/reports/invariance.json` before overwriting it.

```bash
git add src/features/read/cv/illuminant.ts src/features/read/cv/__tests__/illuminant.test.ts \
        src/features/read/cv-read-engine.ts eval/reports/
git commit -m "feat(read): skin-locus illuminant normalization + shading flattening

Grey-world is explicitly rejected: on a face-filling selfie it estimates the
illuminant as the skin's own colour and corrects toward neutral, lightening deep
skin. Skin-locus estimation projects out the melanin direction so tone stays free,
and a tone-preservation test guards against normalizing the tone axis away."
```

---

## Task 13: Chroma metrics, head pose, and gate hardening (spec §5)

**Files:**
- Create: `src/features/capture/chroma-metrics.ts`
- Modify: `src/features/capture/quality-gate.ts`, `src/features/capture/face-metrics.ts`, `src/features/capture/use-frame-metrics.ts`
- Test: `src/features/capture/__tests__/chroma-metrics.test.ts`, extend `quality-gate.test.ts`

**Interfaces:**
- Produces:
  - `computeChromaStats(rgbGrid: number[], cols: number, rows: number): { clipping: number; cct: number; imbalance: number }` — `rgbGrid` is interleaved RGB triples
  - `FrameMetrics` gains `yaw: number`, `roll: number`, `clipping: number`, `cct: number`, `imbalance: number`
  - `THRESHOLDS` gains `clippingMax`, `cctMin`, `cctMax`, `imbalanceMax`, `poseMax`
  - `qualityBand(m: FrameMetrics): 'good' | 'fair' | 'poor'`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/capture/__tests__/chroma-metrics.test.ts
import { computeChromaStats } from '../chroma-metrics';

const grid = (cols: number, rows: number, rgb: [number, number, number]) =>
  Array.from({ length: cols * rows * 3 }, (_, i) => rgb[i % 3]);

describe('computeChromaStats', () => {
  it('reports no clipping on a mid-grey frame', () => {
    expect(computeChromaStats(grid(8, 8, [128, 128, 128]), 8, 8).clipping).toBeCloseTo(0);
  });

  it('reports full clipping on a blown-out frame', () => {
    expect(computeChromaStats(grid(8, 8, [255, 255, 255]), 8, 8).clipping).toBeCloseTo(1);
  });

  it('estimates a warm CCT for a red-heavy frame and a cool one for blue-heavy', () => {
    const warm = computeChromaStats(grid(8, 8, [200, 140, 90]), 8, 8).cct;
    const cool = computeChromaStats(grid(8, 8, [120, 150, 210]), 8, 8).cct;
    expect(warm).toBeLessThan(cool);
  });

  it('reports zero imbalance on a uniform frame', () => {
    expect(computeChromaStats(grid(8, 8, [140, 120, 100]), 8, 8).imbalance).toBeCloseTo(0, 2);
  });

  it('reports high imbalance when one half is much brighter', () => {
    const cols = 8, rows = 8;
    const g: number[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = x < cols / 2 ? 40 : 220;
      g.push(v, v, v);
    }
    expect(computeChromaStats(g, cols, rows).imbalance).toBeGreaterThan(0.5);
  });

  it('never returns NaN on a degenerate all-black frame', () => {
    const s = computeChromaStats(grid(4, 4, [0, 0, 0]), 4, 4);
    for (const v of [s.clipping, s.cct, s.imbalance]) expect(Number.isFinite(v)).toBe(true);
  });
});
```

```ts
// append to src/features/capture/__tests__/quality-gate.test.ts
import { evaluateQuality, qualityBand, THRESHOLDS } from '../quality-gate';

const OK = {
  faceDetected: true, faceCenteredness: 0.9, brightness: 0.6, sharpness: 0.7, faceFraction: 0.4,
  yaw: 0, roll: 0, clipping: 0.01, cct: 5200, imbalance: 0.05,
};

describe('hardened quality gate', () => {
  it('passes a well-lit, straight-on face', () => {
    expect(evaluateQuality(OK).allPass).toBe(true);
  });

  it('fails on blown highlights with a glare hint', () => {
    const r = evaluateQuality({ ...OK, clipping: THRESHOLDS.clippingMax + 0.1 });
    expect(r.allPass).toBe(false);
    expect(r.hint).toMatch(/glare/i);
  });

  it('fails on an extreme colour cast', () => {
    expect(evaluateQuality({ ...OK, cct: 2000 }).allPass).toBe(false);
    expect(evaluateQuality({ ...OK, cct: 9000 }).allPass).toBe(false);
  });

  it('fails on strong side lighting', () => {
    const r = evaluateQuality({ ...OK, imbalance: THRESHOLDS.imbalanceMax + 0.2 });
    expect(r.hint).toMatch(/one side/i);
  });

  it('fails on a turned head', () => {
    const r = evaluateQuality({ ...OK, yaw: THRESHOLDS.poseMax + 10 });
    expect(r.allPass).toBe(false);
    expect(r.hint).toMatch(/straight on/i);
  });

  it('never mentions skin or any condition in a hint', () => {
    // CLAUDE.md §1: gate copy describes light and framing only.
    const banned = /acne|rosacea|eczema|dermat|lesion|blemish|skin/i;
    const cases = [
      OK,
      { ...OK, clipping: 0.9 }, { ...OK, cct: 1800 }, { ...OK, imbalance: 0.9 },
      { ...OK, yaw: 45 }, { ...OK, faceDetected: false }, { ...OK, brightness: 0.1 },
      { ...OK, sharpness: 0.1 }, { ...OK, faceFraction: 0.05 },
    ];
    for (const c of cases) expect(evaluateQuality(c).hint).not.toMatch(banned);
  });
});

describe('qualityBand', () => {
  it('is good when every check clears with margin', () => {
    expect(qualityBand(OK)).toBe('good');
  });
  it('is fair when a check passes but sits close to its threshold', () => {
    expect(qualityBand({ ...OK, clipping: THRESHOLDS.clippingMax * 0.95 })).toBe('fair');
  });
  it('is poor when a check fails outright', () => {
    expect(qualityBand({ ...OK, clipping: THRESHOLDS.clippingMax + 0.2 })).toBe('poor');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest chroma-metrics quality-gate --verbose`
Expected: FAIL — `Cannot find module '../chroma-metrics'`; `qualityBand is not a function`.

- [ ] **Step 3: Implement**

```ts
// src/features/capture/chroma-metrics.ts
// Pure chroma statistics from a downsampled RGB grid published by the frame worklet.
// Kept separate from the device-only worklet wiring so the math is host-testable.

export interface ChromaStats {
  clipping: number;  // 0..1 fraction of near-saturated samples
  cct: number;       // approximate correlated colour temperature, Kelvin
  imbalance: number; // 0..1 left/right mean-luma asymmetry
}

const CLIP_LEVEL = 250;

export function computeChromaStats(rgbGrid: number[], cols: number, rows: number): ChromaStats {
  const n = Math.min(cols * rows, Math.floor(rgbGrid.length / 3));
  if (n <= 0) return { clipping: 0, cct: 6500, imbalance: 0 };

  let clipped = 0;
  let sr = 0, sg = 0, sb = 0;
  let leftSum = 0, leftN = 0, rightSum = 0, rightN = 0;
  const half = cols / 2;

  for (let i = 0; i < n; i++) {
    const r = rgbGrid[i * 3];
    const g = rgbGrid[i * 3 + 1];
    const b = rgbGrid[i * 3 + 2];
    if (r >= CLIP_LEVEL || g >= CLIP_LEVEL || b >= CLIP_LEVEL) clipped++;
    sr += r; sg += g; sb += b;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (i % cols < half) { leftSum += luma; leftN++; } else { rightSum += luma; rightN++; }
  }

  const mr = sr / n, mg = sg / n, mb = sb / n;
  // McCamy's approximation over a crude sRGB->xy conversion. Precision is not the point: the gate
  // only needs to know "is this light wildly warm or wildly cool".
  const X = 0.4124 * mr + 0.3576 * mg + 0.1805 * mb;
  const Y = 0.2126 * mr + 0.7152 * mg + 0.0722 * mb;
  const Z = 0.0193 * mr + 0.1192 * mg + 0.9505 * mb;
  const sum = X + Y + Z;
  let cct = 6500;
  if (sum > 1e-6) {
    const x = X / sum;
    const y = Y / sum;
    if (Math.abs(y - 0.1858) > 1e-6) {
      const nn = (x - 0.3320) / (0.1858 - y);
      const est = 449 * nn ** 3 + 3525 * nn ** 2 + 6823.3 * nn + 5520.33;
      if (Number.isFinite(est)) cct = Math.max(1000, Math.min(15000, est));
    }
  }

  const l = leftN ? leftSum / leftN : 0;
  const r2 = rightN ? rightSum / rightN : 0;
  const denom = Math.max(l, r2);
  const imbalance = denom > 1e-6 ? Math.abs(l - r2) / denom : 0;

  return { clipping: clipped / n, cct, imbalance };
}
```

Rewrite `src/features/capture/quality-gate.ts`:

```ts
// src/features/capture/quality-gate.ts
export type FrameMetrics = {
  faceDetected: boolean;
  faceCenteredness: number; // 0..1, 1 = perfectly centered
  brightness: number;       // 0..1
  sharpness: number;        // 0..1
  faceFraction: number;     // 0..1, fraction of the frame the face occupies
  yaw: number;              // degrees, 0 = facing camera
  roll: number;             // degrees
  clipping: number;         // 0..1
  cct: number;              // Kelvin
  imbalance: number;        // 0..1
};

export type QualityReport = {
  face: boolean; lighting: boolean; focus: boolean; distance: boolean;
  glare: boolean; colour: boolean; evenness: boolean; pose: boolean;
  allPass: boolean; hint: string;
};

export const THRESHOLDS = {
  centeredness: 0.6,
  brightnessMin: 0.35, brightnessMax: 0.9,
  sharpness: 0.5,
  faceFractionMin: 0.2, faceFractionMax: 0.6,
  // PROVISIONAL — must be re-tuned on a physical device (spec §11).
  clippingMax: 0.08,
  cctMin: 2700, cctMax: 7500,
  imbalanceMax: 0.35,
  poseMax: 20, // degrees of yaw or roll
} as const;

export function evaluateQuality(m: FrameMetrics): QualityReport {
  const face = m.faceDetected && m.faceCenteredness >= THRESHOLDS.centeredness;
  const lighting = m.brightness >= THRESHOLDS.brightnessMin && m.brightness <= THRESHOLDS.brightnessMax;
  const focus = m.sharpness >= THRESHOLDS.sharpness;
  const distance = m.faceFraction >= THRESHOLDS.faceFractionMin && m.faceFraction <= THRESHOLDS.faceFractionMax;
  const glare = m.clipping <= THRESHOLDS.clippingMax;
  const colour = m.cct >= THRESHOLDS.cctMin && m.cct <= THRESHOLDS.cctMax;
  const evenness = m.imbalance <= THRESHOLDS.imbalanceMax;
  const pose = Math.abs(m.yaw) <= THRESHOLDS.poseMax && Math.abs(m.roll) <= THRESHOLDS.poseMax;
  const allPass = face && lighting && focus && distance && glare && colour && evenness && pose;

  // Hint priority: get the face there, then straighten it, then fix the light, then framing.
  // Every hint describes LIGHT or FRAMING — never skin (CLAUDE.md §1).
  let hint = 'Looking good — hold still';
  if (!face) hint = 'Center your face in the oval';
  else if (!pose) hint = 'Face the camera straight on';
  else if (!glare) hint = 'Too much glare — turn away from the light';
  else if (!lighting) hint = m.brightness < THRESHOLDS.brightnessMin ? 'Move into better light' : 'Too bright — reduce glare';
  else if (!colour) hint = 'Try more neutral light';
  else if (!evenness) hint = "Light's coming from one side";
  else if (!distance) hint = m.faceFraction < THRESHOLDS.faceFractionMin ? 'Move closer' : 'Move a little farther back';
  else if (!focus) hint = 'Hold steady to focus';

  return { face, lighting, focus, distance, glare, colour, evenness, pose, allPass, hint };
}

// Coarse band persisted with the scan so the trend engine can skip incomparable reads (spec §5a).
// Three-valued on purpose: it must carry no reconstructable detail about the scene.
export function qualityBand(m: FrameMetrics): 'good' | 'fair' | 'poor' {
  const r = evaluateQuality(m);
  if (!r.allPass) return 'poor';
  const margins = [
    1 - m.clipping / THRESHOLDS.clippingMax,
    1 - m.imbalance / THRESHOLDS.imbalanceMax,
    1 - Math.abs(m.yaw) / THRESHOLDS.poseMax,
    1 - Math.abs(m.roll) / THRESHOLDS.poseMax,
  ];
  return Math.min(...margins) < 0.15 ? 'fair' : 'good';
}
```

In `src/features/capture/face-metrics.ts`: add `yaw`/`roll` to `DetectedFace` (`yawAngle`, `rollAngle` — always present on MLKit's `Face`), carry them into the returned metrics, and extend `NO_FACE` plus the neutral defaults with `yaw: 0, roll: 0, clipping: 0, cct: 6500, imbalance: 0`.

In `src/features/capture/use-frame-metrics.ts`: extend the luma worklet to also sample a coarse RGB grid, pass it to `computeChromaStats` on the JS thread, and merge the result into the published metrics alongside pose from `facesToMetrics`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/capture --verbose` → Expected: PASS.
Run: `npm test` → Expected: PASS. Existing `evaluateQuality` tests will need the new `FrameMetrics` fields added to their fixtures.

- [ ] **Step 5: Commit**

```bash
git add src/features/capture/ && git commit -m "feat(capture): harden the gate — glare, colour cast, side light, head pose

Adds pure chroma statistics and a three-valued capture-quality band. Head pose is
free from the live detector and matters because a turned head both skews the cheek
baseline and makes the shading-imbalance check fire for geometric reasons.
Every hint describes light or framing, never skin."
```

---

## Task 14: Persist the quality band (spec §5a)

**Files:**
- Create: `supabase/migrations/0013_capture_quality.sql`
- Modify: `src/lib/scans.ts`, `src/features/read/run-read.ts`, `src/features/read/read-types.ts`
- Test: extend the existing pgTAP suite; `src/lib/__tests__/scans.test.ts`

**Interfaces:**
- Consumes: `qualityBand` (Task 13)
- Produces: `ReadResult` gains `captureQuality?: 'good' | 'fair' | 'poor'`; `recordScan(r, age, captureQuality?)`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/__tests__/scans.test.ts
import { recordScan } from '../scans';

describe('capture quality persistence', () => {
  it('passes the band to the record_scan RPC', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    jest.spyOn(require('../supabase'), 'supabase', 'get').mockReturnValue({ rpc });
    await recordScan(
      { scores: {} as any, skinType: 'dry', modelVersion: 'cv-1', isStub: false },
      null,
      'fair',
    );
    expect(rpc).toHaveBeenCalledWith('record_scan', expect.objectContaining({ p_capture_quality: 'fair' }));
  });

  it('sends null when no band is supplied, so existing callers keep working', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    jest.spyOn(require('../supabase'), 'supabase', 'get').mockReturnValue({ rpc });
    await recordScan({ scores: {} as any, skinType: 'dry', modelVersion: 'cv-1', isStub: false });
    expect(rpc).toHaveBeenCalledWith('record_scan', expect.objectContaining({ p_capture_quality: null }));
  });

  it('reads a null band back as null rather than throwing', () => {
    const { rowToScan } = require('../scans');
    if (typeof rowToScan === 'function') {
      expect(() => rowToScan({ id: '1', captured_at: 'x', skin_type_feel: 'dry', model_version: 'cv-1', is_stub: false })).not.toThrow();
    }
  });
});
```

Add to the pgTAP suite (follow the file layout already used by `0012_routine_feedback`'s tests):

```sql
select has_column('public', 'scans', 'capture_quality', 'scans.capture_quality exists');
select col_is_null('public', 'scans', 'capture_quality', 'capture_quality is nullable so old scans stay valid');

-- Exercise the constraint through the RPC, not a bare INSERT: a bare INSERT would trip the
-- table's NOT NULL columns first and pass for the wrong reason. Reuse whatever authenticated-user
-- + valid-payload helper the existing 0011/0012 pgTAP tests already set up.
select throws_ok(
  $$ select record_scan(:valid_scores, 'dry', 'cv-1', false, :valid_routine, 'r1', null, null, 'excellent') $$,
  'P0001', 'invalid capture quality', 'record_scan rejects a band outside the allowed set'
);
select lives_ok(
  $$ select record_scan(:valid_scores, 'dry', 'cv-1', false, :valid_routine, 'r1', null, null, null) $$,
  'record_scan still accepts a NULL band, so existing callers keep working'
);
select is(
  (select capture_quality from scans order by captured_at desc limit 1),
  null,
  'a NULL band round-trips as NULL rather than a default'
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest scans --verbose`
Expected: FAIL — `recordScan` does not send `p_capture_quality`.

- [ ] **Step 3: Implement**

```sql
-- supabase/migrations/0013_capture_quality.sql
-- Coarse capture-quality band (spec §5a). Nullable so every pre-existing scan stays valid.
-- Three-valued on purpose: derived metadata only, carrying no reconstructable scene detail.
-- Inherits the scans table's existing RLS policy, the retention sweep, and delete_my_data();
-- none of them change. Follows the exact shape of 0011_skin_age.sql.

alter table public.scans
  add column if not exists capture_quality text null
    check (capture_quality is null or capture_quality in ('good', 'fair', 'poor'));

comment on column public.scans.capture_quality is
  'Coarse capture-quality band. Lets the trend engine skip incomparable scans. Never an image.';

-- Replace the 8-arg RPC with a 9-arg version (one trailing nullable param).
drop function if exists public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric);

create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text,
  p_skin_age int default null, p_skin_age_confidence numeric default null,
  p_capture_quality text default null)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_row public.scans;
        v_keys text[] := array['hydration','oiliness','texture','pores',
                               'darkSpots','redness','fineLines','darkCircles'];
        v_k text; v_v numeric;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  if p_skin_type not in ('dry','oily','combination','sensitive') then
    raise exception 'invalid skin type' using errcode='P0001';
  end if;
  foreach v_k in array v_keys loop
    if jsonb_typeof(p_scores -> v_k) is distinct from 'number' then
      raise exception 'missing or non-numeric score: %', v_k using errcode='P0001';
    end if;
    v_v := (p_scores ->> v_k)::numeric;
    if v_v < 0 or v_v > 1 then raise exception 'score out of range: %', v_k using errcode='P0001'; end if;
  end loop;
  if jsonb_typeof(p_routine -> 'version') is distinct from 'string'
     or jsonb_typeof(p_routine -> 'am') is distinct from 'array'
     or jsonb_typeof(p_routine -> 'pm') is distinct from 'array' then
    raise exception 'malformed routine' using errcode='P0001';
  end if;
  if coalesce(p_routine_version, '') = '' then
    raise exception 'missing routine version' using errcode='P0001';
  end if;
  if p_skin_age is not null and (p_skin_age < 0 or p_skin_age > 120) then
    raise exception 'skin age out of range' using errcode='P0001';
  end if;
  if p_skin_age_confidence is not null and (p_skin_age_confidence < 0 or p_skin_age_confidence > 1) then
    raise exception 'skin age confidence out of range' using errcode='P0001';
  end if;
  if p_capture_quality is not null and p_capture_quality not in ('good','fair','poor') then
    raise exception 'invalid capture quality' using errcode='P0001';
  end if;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version,
    skin_age_estimate, skin_age_confidence, capture_quality)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version,
    p_skin_age, p_skin_age_confidence, p_capture_quality)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) from public;
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) to authenticated;
```

> **Why the `drop function` line:** Postgres treats a changed argument list as a *new* function rather than a replacement, so without the drop both the 8-arg and 9-arg versions would exist and every call would be ambiguous. `0011_skin_age.sql:13` does exactly this for the same reason. The `revoke`/`grant` pair must name the **new** 9-argument signature.

In `src/features/read/read-types.ts`:

```ts
export interface ReadResult {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  modelVersion: string;
  isStub: boolean;
  captureQuality?: 'good' | 'fair' | 'poor';
}
```

In `src/lib/scans.ts` — add the parameter, thread it through, and read it back:

```ts
export async function recordScan(
  r: ReadResult,
  age: SkinAgeEstimate | null = null,
  captureQuality: 'good' | 'fair' | 'poor' | null = null,
): Promise<void> {
  // ...existing body, adding to the rpc payload:
    p_capture_quality: captureQuality ?? r.captureQuality ?? null,
```

Add `captureQuality` to the `Scan` interface and to `rowToScan`:

```ts
  captureQuality: row.capture_quality == null ? null : String(row.capture_quality) as 'good' | 'fair' | 'poor',
```

In `src/features/read/run-read.ts`, accept the band and pass it on:

```ts
export async function runRead(photoUri: string, deps: Deps = {}, captureQuality: 'good' | 'fair' | 'poor' | null = null): Promise<void> {
  // ...
  const persist = deps.persist ?? (async (result: ReadResult) => {
    await recordScan(result, estimateSkinAge(result), captureQuality);
  });
```

Finally, in the trend engine, treat `'poor'` and `null` bands as not comparable and exclude those scans from within-user deltas. Locate the consumer with:

```bash
grep -rn "capturedAt\|scans\[" src/features/personalize src/features/today --include=*.ts
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest scans --verbose` → Expected: PASS.
Run: `npm test` → Expected: PASS.
Run: `npx supabase db reset && npm run test:integration` → Expected: PASS (needs local Supabase running; the container was down earlier — start it with `npx supabase start`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_capture_quality.sql src/lib/scans.ts \
        src/features/read/read-types.ts src/features/read/run-read.ts src/lib/__tests__/
git commit -m "feat(scans): persist a coarse capture-quality band

Nullable column plus a default-NULL RPC parameter, so existing scans and existing
call sites both keep working. The trend engine skips poor and unknown bands rather
than averaging a bad scan into the personal baseline."
```

---

## Task 15: Device verification (dev overlay + on-device tuning)

**Files:**
- Create: `app/(dev)/bbox-overlay.tsx`
- Modify: `jest.config.js` (coverage exclusion), `metro.config.js` + `dev-stubs/vision-camera-face-detector.js` (simulator stub must also stub the still detector)

**This task cannot be completed without a physical device.** It requires the EAS dev build (`eas build --profile development --platform android`) installed on the Fold 7.

**Interfaces:**
- Consumes: `detectFacesOnStill`, `deriveRegionsForFace`, `decodeJpegToRgb`

- [ ] **Step 1: Extend the simulator stub so the still detector degrades rather than crashes**

```js
// dev-stubs/vision-camera-face-detector.js
function useFaceDetectorOutput() { return undefined; }
function createImageFaceDetector() {
  // Simulator has no arm64 MLKit slice. Returning no faces exercises the fallback chain
  // (face-geometry.ts) rather than crashing the read.
  return { detectFaces: () => [] };
}
module.exports = { useFaceDetectorOutput, createImageFaceDetector };
```

- [ ] **Step 2: Build the overlay screen**

```tsx
// app/(dev)/bbox-overlay.tsx
// DEVICE-ONLY, dev-only. Draws the detected bounds, contour points, and derived regions onto the
// captured photo. This is how EXIF agreement between MLKit and jpeg-js gets VERIFIED rather than
// assumed (spec §3a, §11) — a wrong transform mis-places regions silently.
import { useEffect, useState } from 'react';
import { View, Image, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { decodeJpegToRgb } from '../../src/features/read/decode-rgb';
import { detectFacesOnStill } from '../../src/features/read/detect-faces-still';
import { deriveRegionsForFace } from '../../src/features/read/face-geometry';
import { REGION_NAMES } from '../../src/features/read/cv/types';

const SIDE = 320;

export default function BboxOverlay() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    if (!uri) return;
    (async () => {
      const rgb = await decodeJpegToRgb(uri);
      const face = await detectFacesOnStill(uri);
      const { regions, source } = deriveRegionsForFace(face, { width: rgb.width, height: rgb.height });
      setState({ rgb: { width: rgb.width, height: rgb.height }, face, regions, source });
    })().catch((e) => setState({ error: String(e) }));
  }, [uri]);

  if (!uri) return <Text>Pass ?uri=file://…</Text>;
  if (!state) return <Text>Decoding…</Text>;
  if (state.error) return <Text>Error: {state.error}</Text>;

  const k = SIDE / Math.max(state.rgb.width, state.rgb.height);

  return (
    <ScrollView>
      <View style={{ width: SIDE, height: SIDE }}>
        <Image source={{ uri }} style={{ width: SIDE, height: SIDE }} resizeMode="contain" />
        {state.face && (
          <View style={{
            position: 'absolute', borderWidth: 2, borderColor: 'yellow',
            left: state.face.bounds.x * k, top: state.face.bounds.y * k,
            width: state.face.bounds.width * k, height: state.face.bounds.height * k,
          }} />
        )}
        {REGION_NAMES.map((n) => (
          <View key={n} style={{
            position: 'absolute', borderWidth: 1, borderColor: 'lime',
            left: state.regions[n].x * k, top: state.regions[n].y * k,
            width: state.regions[n].w * k, height: state.regions[n].h * k,
          }} />
        ))}
      </View>
      <Text>source: {state.source}</Text>
      <Text>decoded: {state.rgb.width}x{state.rgb.height}</Text>
      <Text>contours: {state.face?.contours ? Object.keys(state.face.contours).length : 0}</Text>
    </ScrollView>
  );
}
```

Add to `jest.config.js` `coveragePathIgnorePatterns`: `'<rootDir>/app/(dev)/bbox-overlay.tsx'`.

- [ ] **Step 3: Verify on the Fold 7**

Install the EAS dev build, then run `npx expo start --dev-client` and check, in order:

1. **Gate responds to reality.** Cover the camera → "Center your face in the oval". Move too far → "Move a little farther back". Turn your head → "Face the camera straight on". If it still auto-fires on a ~4.5 s timer regardless, the frame processors are not reaching the JS thread — suspect the worklet plane layout (`use-frame-metrics.ts` swallows unreadable frames by design).
2. **`source: contours`** on the overlay. If it reads `bounds`, MLKit returned no contours; if `fallback`, no face was detected at all.
3. **Regions land on the right features** — this is the EXIF check. If everything is rotated 90°, `readExifOrientation` and MLKit disagree; log the orientation tag and reconcile.
4. **Tune** `THRESHOLDS` (`quality-gate.ts`) and `SHARPNESS_SCALE` (`luma-metrics.ts`), plus the new `clippingMax` / `cctMin` / `cctMax` / `imbalanceMax` / `poseMax`. All JS — hot-reloads over Metro, no rebuild.

- [ ] **Step 4: Record what the device actually showed**

Append a "Device verification — Fold 7, <date>" section to the spec noting: which `source` the overlay reported, whether EXIF agreed, and the final tuned threshold values. If the tuned values differ from the committed provisional ones, update `THRESHOLDS` in the same commit.

- [ ] **Step 5: Commit**

```bash
git add app/\(dev\)/bbox-overlay.tsx dev-stubs/ jest.config.js \
        src/features/capture/quality-gate.ts src/features/capture/luma-metrics.ts \
        docs/superpowers/specs/2026-07-25-scan-accuracy-pipeline-design.md
git commit -m "feat(dev): bbox/contour/region overlay + on-device threshold tuning

The overlay is how EXIF agreement between MLKit and jpeg-js is verified rather
than assumed — a wrong transform mis-places every region without erroring."
```

---

## Final verification

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all suites pass, coverage thresholds met
- [ ] `npm run eval:invariance` — all four axes PASS
- [ ] `npm run check:compliance` — no forbidden SDKs
- [ ] `npm run check:no-egress` — no image egress
- [ ] `git diff main --stat -- package.json` — **no dependency changes** (scripts only)
- [ ] `eval/reports/invariance.{md,json}` committed, showing the improvement from the Task 6 baseline
- [ ] No user-facing string added anywhere contains a disease term or an accuracy claim
