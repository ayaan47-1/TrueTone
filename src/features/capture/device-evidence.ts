// Device-test evidence (tt-gap05 / tt-gap08). Pure helpers that turn one capture + read into a
// single greppable log line, so a founder's direct-install run returns reproducible numbers
// instead of "looked fine". Test-build instrumentation only: enabled by
// EXPO_PUBLIC_CAPTURE_EVIDENCE=1, written to the device console, never rendered in the UI and
// never sent to the backend. It carries derived numbers only — never the image, a URI, or bytes
// (CLAUDE.md §1, §3). The limits below are the runbook's pass bars, not product thresholds.
import type { Lab, Rect, Regions, RgbImage } from '../read/cv/types';
import { clampRect, rgbAt } from '../read/cv/sampling';

/** A channel value ABOVE this counts as clipped (runbook: "RGB>245"). */
export const CLIP_RGB_THRESHOLD = 245;

export const EVIDENCE_LIMITS = {
  /** Worst skin region may have at most 1% clipped pixels. PROVISIONAL test bar. */
  maxSkinClipFraction: 0.01,
  /** Bright-room vs dim-room tone read must differ by less than this (CIE76 delta-E). */
  maxDeltaE: 2.0,
} as const;

/** Regions the flash lands on hardest; the runbook checks these for blown highlights. */
const CLIP_REGIONS = ['cheekL', 'cheekR', 'forehead'] as const;

const EVIDENCE_PREFIX = '[tt-evidence] ';

export function regionClipFraction(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let clipped = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      if (rr > CLIP_RGB_THRESHOLD || gg > CLIP_RGB_THRESHOLD || bb > CLIP_RGB_THRESHOLD) clipped++;
    }
  }
  return clipped / (r.w * r.h);
}

/** CIE76 colour difference: Euclidean distance in Lab. */
export function deltaE76(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

export function compareRooms(bright: Lab, dim: Lab): { deltaE: number; pass: boolean } {
  const deltaE = round2(deltaE76(bright, dim));
  return { deltaE, pass: deltaE < EVIDENCE_LIMITS.maxDeltaE };
}

export interface ScanEvidence {
  kind: 'scan';
  readOk: boolean;
  imageDeleted: boolean;
  skinClipFraction: number | null;
  clipPass: boolean | null;
  tone: Lab | null;
}

/** Worst clipped fraction across the cheek + forehead regions, rounded for the log. */
export function skinClipFraction(img: RgbImage, regions: Regions): number {
  return round4(Math.max(...CLIP_REGIONS.map((n) => regionClipFraction(img, regions[n]))));
}

export interface ScanEvidenceInput {
  readOk: boolean;
  imageDeleted: boolean;
  skinClipFraction?: number;
  tone?: Lab;
}

export function buildScanEvidence(input: ScanEvidenceInput): ScanEvidence {
  const { tone } = input;
  const skinClipFraction = input.skinClipFraction ?? null;
  return {
    kind: 'scan',
    readOk: input.readOk,
    imageDeleted: input.imageDeleted,
    skinClipFraction,
    clipPass: skinClipFraction === null ? null : skinClipFraction <= EVIDENCE_LIMITS.maxSkinClipFraction,
    tone: tone ? { L: round2(tone.L), a: round2(tone.a), b: round2(tone.b) } : null,
  };
}

export function formatEvidenceLine(evidence: object): string {
  return EVIDENCE_PREFIX + JSON.stringify(evidence);
}

export function isEvidenceEnabled(flag: string | undefined): boolean {
  return flag === '1';
}

/** Default sink: one console line when the test-build flag is set, otherwise nothing. */
export function logEvidence(evidence: object): void {
  if (isEvidenceEnabled(process.env.EXPO_PUBLIC_CAPTURE_EVIDENCE)) {
    console.log(formatEvidenceLine(evidence));
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
