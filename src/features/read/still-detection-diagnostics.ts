// PURE classification of what the still-image face detector actually did. No native, host-tested.
//
// Why this exists (device pass, Fold 7, 2026-07-26): once the still was finally written upright,
// the overlay still reported "detector found a face: no" on a clear, well-lit, correctly-framed
// portrait. `detectFacesOnStill` collapses every possible failure — the native module missing, a
// thrown call, an empty result, a result whose shape it cannot read — into a single `null`. Those
// four have completely different fixes, and the screen could not tell them apart.
//
// This module turns the raw return value into a named outcome so the dev overlay can say which one
// happened. It deliberately does no native work, so the classification is testable off-device.

export type DetectionOutcome =
  /** Faces came back and at least one had usable bounds. */
  | 'ok'
  /** The require() or the factory call failed — the native module is not linked or not present. */
  | 'module-unavailable'
  /** detectFaces() itself threw — a bad URI, an unreadable file, a native crash. */
  | 'threw'
  /** The call succeeded and MLKit genuinely saw nothing. */
  | 'empty'
  /** Faces came back, but not one of them had readable bounds — a shape mismatch, not a miss. */
  | 'unusable-shape'
  /** detectFaces() returned something that is not a list at all. */
  | 'not-a-list';

export interface StillDetectionReport {
  outcome: DetectionOutcome;
  /** How many entries came back, when that is knowable. */
  rawCount: number;
  /** Error message when `outcome` is 'threw' or 'module-unavailable'. */
  error: string | null;
  /**
   * Property names visible on the first returned entry. Empty for a Nitro HybridObject, whose
   * properties live on a prototype and do not enumerate — which is itself diagnostic, so an empty
   * list here alongside 'unusable-shape' points at the reader, not at the detector.
   */
  firstKeys: string[];
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function reportModuleUnavailable(err: unknown): StillDetectionReport {
  return { outcome: 'module-unavailable', rawCount: 0, error: message(err), firstKeys: [] };
}

export function reportThrew(err: unknown): StillDetectionReport {
  return { outcome: 'threw', rawCount: 0, error: message(err), firstKeys: [] };
}

/**
 * Classify a successful detectFaces() call. `usableCount` is how many entries the caller's own
 * bounds reader could actually read — passing it in keeps this module free of the reader's
 * shape-guard logic while still letting it distinguish "saw nothing" from "saw something I could
 * not parse".
 */
export function classifyDetection(faces: unknown, usableCount: number): StillDetectionReport {
  if (!Array.isArray(faces)) {
    return { outcome: 'not-a-list', rawCount: 0, error: null, firstKeys: [] };
  }
  const firstKeys = faces.length > 0 && faces[0] && typeof faces[0] === 'object'
    ? Object.keys(faces[0] as Record<string, unknown>)
    : [];
  if (faces.length === 0) {
    return { outcome: 'empty', rawCount: 0, error: null, firstKeys };
  }
  if (usableCount <= 0) {
    return { outcome: 'unusable-shape', rawCount: faces.length, error: null, firstKeys };
  }
  return { outcome: 'ok', rawCount: faces.length, error: null, firstKeys };
}

/** One line for the dev overlay, phrased as what to do about it. */
export function describeOutcome(r: StillDetectionReport): string {
  switch (r.outcome) {
    case 'ok':
      return `${r.rawCount} face(s), bounds readable.`;
    case 'module-unavailable':
      return `The detector module could not be loaded (${r.error}). Check that the dev-stub is NOT aliased and that the native module is in this build.`;
    case 'threw':
      return `detectFaces() threw: ${r.error}. A URI form it cannot open is the usual cause — try the path with and without the file:// prefix.`;
    case 'empty':
      return 'The call worked and MLKit saw no face. If the face below looks upright and well lit, suspect the image handed to it, not the detector.';
    case 'unusable-shape':
      return `${r.rawCount} face(s) came back but none had readable bounds${r.firstKeys.length === 0 ? ' and none of their properties enumerate, which is what a Nitro HybridObject looks like' : ` (keys: ${r.firstKeys.join(', ')})`}. This is a reader bug, not a detection miss.`;
    case 'not-a-list':
      return 'detectFaces() returned something that is not a list. The binding shape has changed.';
  }
}
