import {
  deriveShade,
  deriveDepth,
  deriveUndertone,
  deriveFinish,
  depthWord,
} from '../derive-shade';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { ShadeReadInput } from '../shade-types';

const base: ShadeReadInput = { lightness: 0.5, warmth: 0, olive: 0, skinType: 'combination', oiliness: 0.3 };
const read = (o: Partial<ShadeReadInput> = {}): ShadeReadInput => ({ ...base, ...o });

describe('deriveDepth', () => {
  test('fairest lightness maps to depth 1, deepest to 10', () => {
    expect(deriveDepth(1)).toBe(1);
    expect(deriveDepth(0)).toBe(10);
  });
  test('mid lightness lands mid-scale and clamps out-of-range input', () => {
    expect(deriveDepth(0.5)).toBe(6); // round(4.5)=5, +1 offset
    expect(deriveDepth(2)).toBe(1); // clamped to fairest
    expect(deriveDepth(-1)).toBe(10); // clamped to deepest
  });
});

describe('deriveUndertone', () => {
  test('olive cast dominates when strong', () => {
    expect(deriveUndertone(0.9, 0.7)).toBe('olive');
  });
  test('warmth sign picks warm/cool, near-zero is neutral', () => {
    expect(deriveUndertone(0.4, 0)).toBe('warm');
    expect(deriveUndertone(-0.4, 0)).toBe('cool');
    expect(deriveUndertone(0.05, 0)).toBe('neutral');
    expect(deriveUndertone(-0.05, 0.1)).toBe('neutral');
  });
});

describe('deriveFinish', () => {
  test('oily read (by type or score) picks matte', () => {
    expect(deriveFinish('oily', 0.2)).toBe('matte');
    expect(deriveFinish('combination', 0.8)).toBe('matte');
  });
  test('dry -> dewy, combination -> satin, sensitive -> natural', () => {
    expect(deriveFinish('dry', 0.2)).toBe('dewy');
    expect(deriveFinish('combination', 0.2)).toBe('satin');
    expect(deriveFinish('sensitive', 0.2)).toBe('natural');
  });
});

describe('depthWord', () => {
  test('bands cover the full 1..10 range in cosmetic words', () => {
    expect([1, 2].map(depthWord)).toEqual(['Fair', 'Fair']);
    expect(depthWord(3)).toBe('Light');
    expect(depthWord(6)).toBe('Medium');
    expect(depthWord(8)).toBe('Tan');
    expect(depthWord(10)).toBe('Deep');
  });
});

describe('deriveShade', () => {
  test('composes shade name from depth + undertone words', () => {
    expect(deriveShade(read({ lightness: 0.5, warmth: 0.4 }))).toEqual({
      shadeName: 'Medium Warm',
      undertone: 'warm',
      depth: 6,
      finish: 'satin',
    });
  });

  test('deep cool dry read', () => {
    expect(deriveShade(read({ lightness: 0.05, warmth: -0.5, skinType: 'dry' }))).toEqual({
      shadeName: 'Deep Cool',
      undertone: 'cool',
      depth: 10,
      finish: 'dewy',
    });
  });

  test('fair olive oily read', () => {
    expect(deriveShade(read({ lightness: 0.95, olive: 0.8, skinType: 'oily' }))).toEqual({
      shadeName: 'Fair Olive',
      undertone: 'olive',
      depth: 1,
      finish: 'matte',
    });
  });

  test('is pure and deterministic (same input -> equal output, input untouched)', () => {
    const input = read({ lightness: 0.3, warmth: 0.2 });
    const frozen = Object.freeze({ ...input });
    expect(deriveShade(frozen)).toEqual(deriveShade(frozen));
  });

  test('derived shade names carry zero disease/diagnostic terms', () => {
    const inputs: ShadeReadInput[] = [
      read({ lightness: 0, warmth: 1, olive: 0 }),
      read({ lightness: 1, warmth: -1, olive: 0 }),
      read({ lightness: 0.5, warmth: 0, olive: 0.9 }),
      read({ lightness: 0.5, warmth: 0, olive: 0 }),
    ];
    for (const i of inputs) {
      expect(findDiseaseTerms(deriveShade(i).shadeName)).toEqual([]);
    }
  });
});
