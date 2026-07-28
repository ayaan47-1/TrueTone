import { REGION_NAMES } from '../../../src/features/read/cv/types';
import { renderFace } from '../face';
import { scoreRenderedFace } from '../score';

function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      (a.y > y) !== (b.y > y)
      && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

describe('scoreRenderedFace', () => {
  it.each([
    { scale: 1, dx: 0, dy: 0 },
    { scale: 0.85, dx: 0, dy: 0 },
    { scale: 1.1, dx: 0, dy: 0 },
    { scale: 1, dx: 0.04, dy: 0 },
    { scale: 1, dx: -0.04, dy: 0 },
    { scale: 1, dx: 0, dy: 0.04 },
  ])('scores geometry $scale/$dx/$dy through contours only', (geometry) => {
    const rendered = renderFace({ geometry });
    const scored = scoreRenderedFace(rendered);

    expect(scored.regionSource).toBe('contours');
    for (const name of REGION_NAMES) {
      const region = scored.regions[name];
      const corners = [
        [region.x, region.y],
        [region.x + region.w, region.y],
        [region.x, region.y + region.h],
        [region.x + region.w, region.y + region.h],
      ];
      for (const [x, y] of corners) {
        expect(pointInPolygon(x, y, rendered.contours.FACE)).toBe(true);
      }
    }
  });

  it('fails closed when synthetic contours cannot produce regions', () => {
    const rendered = renderFace();
    const { LEFT_CHEEK: _missing, ...incomplete } = rendered.contours;

    expect(() => scoreRenderedFace({
      ...rendered,
      contours: incomplete as typeof rendered.contours,
    })).toThrow(/contour/i);
  });
});
