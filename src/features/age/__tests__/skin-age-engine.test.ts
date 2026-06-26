// src/features/age/__tests__/skin-age-engine.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ReadResult } from '../../read/read-types';

const read: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination',
  modelVersion: 'stub-1',
  isStub: true,
};

describe('estimateSkinAge', () => {
  afterEach(() => jest.resetModules());

  it('returns null while the absolute-age flag is dark (default)', () => {
    jest.resetModules();
    const { estimateSkinAge } = require('../skin-age-engine');
    expect(estimateSkinAge(read)).toBeNull();
  });

  it('produces a bounded, confident estimate when the flag is enabled', () => {
    jest.resetModules();
    jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
    const { estimateSkinAge, AGE_MODEL_VERSION } = require('../skin-age-engine');
    const est = estimateSkinAge(read)!;
    expect(est).not.toBeNull();
    expect(est.ageEstimate).toBeGreaterThanOrEqual(0);
    expect(est.ageEstimate).toBeLessThanOrEqual(120);
    expect(est.confidence).toBeGreaterThanOrEqual(0);
    expect(est.confidence).toBeLessThanOrEqual(1);
    expect(est.modelVersion).toBe(AGE_MODEL_VERSION);
    jest.dontMock('../age-flags');
  });

  it('is deterministic for the same read', () => {
    jest.resetModules();
    jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
    const { estimateSkinAge } = require('../skin-age-engine');
    expect(estimateSkinAge(read)).toEqual(estimateSkinAge(read));
    jest.dontMock('../age-flags');
  });
});
