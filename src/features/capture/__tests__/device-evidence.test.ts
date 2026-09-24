import {
  CLIP_RGB_THRESHOLD,
  EVIDENCE_LIMITS,
  buildScanEvidence,
  compareRooms,
  deltaE76,
  formatEvidenceLine,
  isEvidenceEnabled,
  regionClipFraction,
  skinClipFraction,
} from '../device-evidence';
import { solidRgb } from '../../read/cv/fixtures';
import { REGION_NAMES, type Regions } from '../../read/cv/types';

const fullFrame = (w: number, h: number): Regions =>
  Object.fromEntries(REGION_NAMES.map((n) => [n, { x: 0, y: 0, w, h }])) as Regions;

describe('regionClipFraction', () => {
  it('counts a pixel as clipped only when a channel is ABOVE the threshold', () => {
    expect(CLIP_RGB_THRESHOLD).toBe(245);
    expect(regionClipFraction(solidRgb(4, 4, [245, 200, 180]), { x: 0, y: 0, w: 4, h: 4 })).toBe(0);
    expect(regionClipFraction(solidRgb(4, 4, [246, 200, 180]), { x: 0, y: 0, w: 4, h: 4 })).toBe(1);
  });

  it('returns the clipped fraction of the region', () => {
    const img = solidRgb(4, 2, [180, 140, 120]);
    for (let x = 0; x < 4; x++) img.data[x * 4 + 2] = 255; // top row: blue channel clipped
    expect(regionClipFraction(img, { x: 0, y: 0, w: 4, h: 2 })).toBe(0.5);
  });
});

describe('deltaE76 / compareRooms', () => {
  it('is the Euclidean Lab distance', () => {
    expect(deltaE76({ L: 50, a: 0, b: 0 }, { L: 50, a: 0, b: 0 })).toBe(0);
    expect(deltaE76({ L: 50, a: 0, b: 0 }, { L: 53, a: 4, b: 0 })).toBe(5);
  });

  it('passes strictly below the delta-E limit', () => {
    expect(EVIDENCE_LIMITS.maxDeltaE).toBe(2.0);
    expect(compareRooms({ L: 50, a: 0, b: 0 }, { L: 51.9, a: 0, b: 0 }).pass).toBe(true);
    expect(compareRooms({ L: 50, a: 0, b: 0 }, { L: 52, a: 0, b: 0 }).pass).toBe(false);
  });
});

describe('skinClipFraction', () => {
  it('is the WORST of the cheek and forehead regions, not the average', () => {
    const img = solidRgb(10, 10, [180, 140, 120]);
    for (let x = 0; x < 10; x++) img.data[x * 4] = 255; // clip row 0 only
    const regions = { ...fullFrame(10, 10), forehead: { x: 0, y: 0, w: 10, h: 1 } };
    expect(skinClipFraction(img, regions)).toBe(1);
  });
});

describe('buildScanEvidence', () => {
  it('reports the worst skin-region clip fraction and a pass/fail against the limit', () => {
    const ok = buildScanEvidence({
      skinClipFraction: skinClipFraction(solidRgb(8, 8, [180, 140, 120]), fullFrame(8, 8)),
      tone: { L: 61.234, a: 12.345, b: 18.999 },
      readOk: true,
      imageDeleted: true,
    });
    expect(ok).toEqual({
      kind: 'scan',
      readOk: true,
      imageDeleted: true,
      skinClipFraction: 0,
      clipPass: true,
      tone: { L: 61.23, a: 12.35, b: 19 },
    });

    const clipped = buildScanEvidence({
      skinClipFraction: skinClipFraction(solidRgb(8, 8, [255, 250, 250]), fullFrame(8, 8)),
      tone: undefined,
      readOk: true,
      imageDeleted: true,
    });
    expect(clipped.skinClipFraction).toBe(1);
    expect(clipped.clipPass).toBe(false);
    expect(clipped.tone).toBeNull();
  });

  it('records a failed read with no pixel metrics', () => {
    expect(buildScanEvidence({ readOk: false, imageDeleted: true })).toEqual({
      kind: 'scan',
      readOk: false,
      imageDeleted: true,
      skinClipFraction: null,
      clipPass: null,
      tone: null,
    });
  });
});

describe('formatEvidenceLine / isEvidenceEnabled', () => {
  it('prefixes one JSON line so the tester can grep device logs', () => {
    const line = formatEvidenceLine({ kind: 'x', n: 1 });
    expect(line.startsWith('[tt-evidence] ')).toBe(true);
    expect(JSON.parse(line.slice('[tt-evidence] '.length))).toEqual({ kind: 'x', n: 1 });
  });

  it('is enabled only by the explicit "1" flag', () => {
    expect(isEvidenceEnabled('1')).toBe(true);
    expect(isEvidenceEnabled(undefined)).toBe(false);
    expect(isEvidenceEnabled('true')).toBe(false);
  });
});
