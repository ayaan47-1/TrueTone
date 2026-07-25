import { renderFace } from '../../../../../eval/render/face';
import { scoreFromBbox } from '../score-from-rgb';

const D0 = { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 };
const FST = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;
const oilinessAt = (fst: (typeof FST)[number], v: number) => {
  const { rgb, bbox } = renderFace({ fst, defects: { ...D0, oiliness: v } });
  return scoreFromBbox(rgb, bbox).scores.oiliness;
};

describe('oiliness is detectable on every skin tone', () => {
  it.each(FST)('registers real shine on Fitzpatrick %s', (fst) => {
    // Before this task, FST I scored exactly 0.0000 at every level because the specular floor
    // (baselineL* x 1.2 = 105.4) sat above CIELAB's ceiling of 100.
    expect(oilinessAt(fst, 1)).toBeGreaterThan(0.1);
  });

  it.each(FST)('reads a clean face as not oily on Fitzpatrick %s', (fst) => {
    expect(oilinessAt(fst, 0)).toBeLessThan(0.05);
  });

  it('has no strong monotonic sensitivity gradient across tones', () => {
    // The fairness property: the SAME simulated shine must read similarly on every tone.
    // Before this task the spread across FST I-VI was 0.0000..0.5511.
    const vals = FST.map((f) => oilinessAt(f, 1));
    const spread = Math.max(...vals) - Math.min(...vals);
    expect(spread).toBeLessThan(0.25);
  });
});
