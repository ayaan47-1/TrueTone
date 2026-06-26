// src/features/read/__tests__/run-stub-read-age.test.ts
// TDD: verifies that runStubRead computes the age estimate and passes it to recordScan.
jest.mock('../../../lib/scans', () => ({ recordScan: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../age/skin-age-engine', () => ({
  estimateSkinAge: jest.fn().mockReturnValue({ ageEstimate: 33, confidence: 0.6, modelVersion: 'age-stub-1' }),
}));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));

import { runStubRead } from '../run-stub-read';
import { recordScan } from '../../../lib/scans';
import { estimateSkinAge } from '../../age/skin-age-engine';

const mockRecordScan = recordScan as jest.Mock;
const mockEstimateSkinAge = estimateSkinAge as jest.Mock;

beforeEach(() => { mockRecordScan.mockClear(); mockEstimateSkinAge.mockClear(); });

test('computes the age estimate and passes it to recordScan', async () => {
  await runStubRead('file://photo.jpg');
  expect(mockEstimateSkinAge).toHaveBeenCalledTimes(1);
  expect(mockRecordScan).toHaveBeenCalledTimes(1);
  expect(mockRecordScan.mock.calls[0][1]).toEqual({ ageEstimate: 33, confidence: 0.6, modelVersion: 'age-stub-1' });
});
