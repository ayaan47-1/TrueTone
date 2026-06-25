// src/features/read/__tests__/run-read-age.test.ts
// TDD: verifies that the default persist in runRead computes estimateSkinAge and forwards
// the estimate to recordScan. deps.persist is NOT injected — the test exercises the real wiring.
jest.mock('../../../lib/scans', () => ({ recordScan: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../age/skin-age-engine', () => ({
  estimateSkinAge: jest.fn().mockReturnValue({ ageEstimate: 28, confidence: 0.75, modelVersion: 'age-stub-1' }),
}));

import { runRead } from '../run-read';
import { recordScan } from '../../../lib/scans';
import { estimateSkinAge } from '../../age/skin-age-engine';
import type { ReadEngine } from '../read-engine';
import type { ReadResult } from '../read-types';
import type { SkinAgeEstimate } from '../../age/age-types';

const mockRecordScan = recordScan as jest.Mock;
const mockEstimateSkinAge = estimateSkinAge as jest.Mock;

const fakeResult: ReadResult = {
  scores: {
    hydration: 0.6,
    oiliness: 0.4,
    texture: 0.3,
    pores: 0.5,
    darkSpots: 0.2,
    redness: 0.1,
    fineLines: 0.4,
    darkCircles: 0.3,
  },
  skinType: 'dry',
  modelVersion: 'cv-1',
  isStub: false,
};

const fakeEstimate: SkinAgeEstimate = { ageEstimate: 28, confidence: 0.75, modelVersion: 'age-stub-1' };

beforeEach(() => {
  mockRecordScan.mockClear();
  mockEstimateSkinAge.mockClear();
});

test('default persist computes estimateSkinAge and forwards the estimate to recordScan', async () => {
  const engine: ReadEngine = { run: async () => fakeResult };
  await runRead('file:///tmp/face.jpg', { engine });
  expect(mockEstimateSkinAge).toHaveBeenCalledWith(fakeResult);
  expect(mockRecordScan).toHaveBeenCalledTimes(1);
  expect(mockRecordScan.mock.calls[0][1]).toEqual(fakeEstimate);
});
