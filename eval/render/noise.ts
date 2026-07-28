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
  baseCells = 2,
): Float32Array {
  const out = new Float32Array(width * height);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = Math.max(2, baseCells << o);
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

// Piecewise-constant several-pixel cells: enough spatial correlation to distinguish rough skin
// structure from independent sensor grain, while keeping deterministic amplitude semantics.
export function blockNoise2d(
  rng: () => number,
  width: number,
  height: number,
  blockSize: number,
): Float32Array {
  const size = Math.max(1, Math.round(blockSize));
  const blockCols = Math.ceil(width / size);
  const blockRows = Math.ceil(height / size);
  const blocks = lattice(rng, blockCols, blockRows);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = blocks[Math.floor(y / size) * blockCols + Math.floor(x / size)];
    }
  }

  let mean = 0;
  for (let i = 0; i < out.length; i++) mean += out[i];
  mean /= out.length;

  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] -= mean;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

// Several-pixel cells arranged in locally zero-mean 2x2 groups. This preserves correlated
// roughness energy while preventing random same-sign clusters from becoming broad dark patches
// after spatial averaging.
export function balancedBlockNoise2d(
  rng: () => number,
  width: number,
  height: number,
  blockSize: number,
): Float32Array {
  const size = Math.max(1, Math.round(blockSize));
  const blockCols = Math.ceil(width / size);
  const blockRows = Math.ceil(height / size);
  const blocks = new Float32Array(blockCols * blockRows);

  for (let macroY = 0; macroY < blockRows; macroY += 2) {
    for (let macroX = 0; macroX < blockCols; macroX += 2) {
      const amplitude = Math.abs(rng() * 2 - 1);
      const orientation = rng() < 0.5 ? 1 : -1;
      const cells: Array<{ x: number; y: number; value: number }> = [];
      for (let dy = 0; dy < 2 && macroY + dy < blockRows; dy++) {
        for (let dx = 0; dx < 2 && macroX + dx < blockCols; dx++) {
          cells.push({
            x: macroX + dx,
            y: macroY + dy,
            value: amplitude * orientation * ((dx + dy) % 2 === 0 ? 1 : -1),
          });
        }
      }
      const mean = cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length;
      for (const cell of cells) blocks[cell.y * blockCols + cell.x] = cell.value - mean;
    }
  }

  let peak = 0;
  for (const value of blocks) peak = Math.max(peak, Math.abs(value));
  if (peak > 0) for (let i = 0; i < blocks.length; i++) blocks[i] /= peak;

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = blocks[Math.floor(y / size) * blockCols + Math.floor(x / size)];
    }
  }
  return out;
}
