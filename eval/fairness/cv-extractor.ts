// Wires the pure CV read into the fairness harness over the synthetic self-test set — no
// device, no real faces. Real consented images are the separate, legally-gated sub-project D.
import { scoreFromBbox } from '../../src/features/read/cv/score-from-rgb';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { Extractor } from './run-eval';
import type { ManifestEntry } from './manifest';
import { FITZPATRICK } from './fst';
import { renderSelfTestFace } from './self-test-images';

const PASS_GATE: QualityReport = {
  face: true, lighting: true, focus: true, distance: true,
  glare: true, colour: true, evenness: true, pose: true,
  allPass: true, hint: '',
};

export const cvSelfTestExtractor: Extractor = async (entry) => {
  const { rgb, bbox } = renderSelfTestFace(entry.fst);
  return { gate: PASS_GATE, scores: scoreFromBbox(rgb, bbox).scores };
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
