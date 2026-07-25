import { oiliness } from '../oiliness';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('oiliness rises with specular highlights in the T-zone', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const matte = solidRgb(100, 100, [180, 140, 120]);
  const shiny = fillRect(matte, regions.tZone, [250, 250, 250]);
  // The specular fraction is measured relative to the person's own cheek baseline, so the
  // baseline must be sampled per-image (spec 4a / F3) — it is identical here since the highlight
  // is confined to the T-zone and the baseline is sampled from the cheeks.
  const baseline = sampleBaseline(matte, regions);

  expect(oiliness(shiny, regions, baseline)).toBeGreaterThan(oiliness(matte, regions, baseline));
  expect(oiliness(matte, regions, baseline)).toBeGreaterThanOrEqual(0);
  expect(oiliness(shiny, regions, baseline)).toBeLessThanOrEqual(1);
});

test('oiliness is invariant to a uniform exposure change (relative, not absolute, threshold)', () => {
  // The old absolute 0.8-luma threshold made this scale with exposure and returned 0 on any
  // underexposed capture. The relative (baseline-lift) measure must not.
  const regions = deriveRegions(BBOX, SIZE);
  const dimBase = solidRgb(100, 100, [90, 70, 60]);
  const dimShiny = fillRect(dimBase, regions.tZone, [140, 130, 125]);
  const dimBaseline = sampleBaseline(dimBase, regions);

  const brightBase = solidRgb(100, 100, [180, 140, 120]);
  const brightShiny = fillRect(brightBase, regions.tZone, [250, 246, 244]);
  const brightBaseline = sampleBaseline(brightBase, regions);

  expect(oiliness(dimShiny, regions, dimBaseline)).toBeGreaterThan(0);
  expect(oiliness(dimShiny, regions, dimBaseline)).toBeCloseTo(
    oiliness(brightShiny, regions, brightBaseline),
    1,
  );
});
