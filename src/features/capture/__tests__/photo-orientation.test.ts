import {
  checkOrientationApplied,
  uprightRotationDegrees,
} from '../photo-orientation';

const LANDSCAPE = { width: 4000, height: 3000 };
const PORTRAIT = { width: 3000, height: 4000 };

describe('uprightRotationDegrees', () => {
  it('needs no rotation for an already-upright buffer', () => {
    expect(uprightRotationDegrees('up')).toBe(0);
  });

  // 'left' means the content's top now points left, so turning it clockwise puts it back up.
  it('corrects a left-rotated buffer with a quarter turn clockwise', () => {
    expect(uprightRotationDegrees('left')).toBe(90);
  });

  it('corrects a right-rotated buffer with three quarter turns clockwise', () => {
    expect(uprightRotationDegrees('right')).toBe(270);
  });

  it('corrects an upside-down buffer with a half turn', () => {
    expect(uprightRotationDegrees('down')).toBe(180);
  });
});

describe('checkOrientationApplied', () => {
  it('reports applied when a quarter turn swapped the axes', () => {
    expect(checkOrientationApplied('left', LANDSCAPE, PORTRAIT)).toEqual({
      applied: true,
      residualDegrees: 0,
    });
  });

  it('reports NOT applied, with the correction still owed, when the axes did not swap', () => {
    expect(checkOrientationApplied('left', LANDSCAPE, LANDSCAPE)).toEqual({
      applied: false,
      residualDegrees: 90,
    });
    expect(checkOrientationApplied('right', LANDSCAPE, LANDSCAPE)).toEqual({
      applied: false,
      residualDegrees: 270,
    });
  });

  // This is the Fold 7 bug: a landscape sensor buffer reaching the read unrotated.
  it('owes a quarter turn for the observed 3648x2736 landscape still', () => {
    const sensor = { width: 3648, height: 2736 };
    expect(checkOrientationApplied('left', sensor, sensor)).toEqual({
      applied: false,
      residualDegrees: 90,
    });
  });

  it('cannot tell for orientations that do not swap the axes', () => {
    for (const o of ['up', 'down'] as const) {
      expect(checkOrientationApplied(o, LANDSCAPE, LANDSCAPE)).toEqual({
        applied: null,
        residualDegrees: 0,
      });
    }
  });

  // A square buffer satisfies width===height trivially, so the swap test would read as a false
  // "applied". Refusing to answer is the only safe result.
  it('refuses to answer for a square buffer, where the swap test is vacuous', () => {
    const square = { width: 3000, height: 3000 };
    expect(checkOrientationApplied('left', square, square)).toEqual({
      applied: null,
      residualDegrees: 0,
    });
  });

  // Never guess: if the conversion also resized, neither branch is evidence of anything.
  it('refuses to answer when the image matches neither the buffer nor its transpose', () => {
    expect(checkOrientationApplied('left', LANDSCAPE, { width: 1000, height: 750 })).toEqual({
      applied: null,
      residualDegrees: 0,
    });
  });

  it('refuses to answer on degenerate sizes', () => {
    expect(checkOrientationApplied('left', { width: 0, height: 0 }, PORTRAIT)).toEqual({
      applied: null,
      residualDegrees: 0,
    });
    expect(checkOrientationApplied('left', LANDSCAPE, { width: -1, height: 4000 })).toEqual({
      applied: null,
      residualDegrees: 0,
    });
  });
});
