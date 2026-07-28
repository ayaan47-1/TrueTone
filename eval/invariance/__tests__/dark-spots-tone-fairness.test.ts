import { FITZPATRICK } from '../../fairness/fst';
import { renderFace } from '../../render/face';
import { scoreRenderedFace } from '../../render/score';
import { INVARIANCE_THRESHOLDS } from '../thresholds';

const DEFECT_LEVELS = [0, 0.1, 0.25, 0.5, 0.75, 1] as const;
const NOISE_SEEDS = [1, 7, 19, 41, 97] as const;
const NO_OTHER_DEFECTS = {
  redness: 0,
  oiliness: 0,
  pores: 0,
  lines: 0,
  darkCircles: 0,
  roughness: 0,
};

describe('dark-spots tone fairness through production contour regions', () => {
  it.each(NOISE_SEEDS)('stays within the tone-spread limit for noise seed %i', (seed) => {
    for (const spots of DEFECT_LEVELS) {
      const scores = FITZPATRICK.map((fst) =>
        scoreRenderedFace(renderFace({
          fst,
          seed,
          defects: { ...NO_OTHER_DEFECTS, spots },
        })).scores.darkSpots,
      );
      const spread = Math.max(...scores) - Math.min(...scores);

      expect(spread).toBeLessThanOrEqual(INVARIANCE_THRESHOLDS.toneResponseSpread);
    }
  });

  it('has no clean-skin floor on any Fitzpatrick tone', () => {
    for (const fst of FITZPATRICK) {
      const score = scoreRenderedFace(renderFace({
        fst,
        defects: { ...NO_OTHER_DEFECTS, spots: 0 },
      })).scores.darkSpots;
      expect(score).toBe(0);
    }
  });
});
