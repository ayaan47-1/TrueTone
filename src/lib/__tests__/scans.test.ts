const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) } }));

import { recordScan, fetchLatestScan } from '../scans';
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../../features/read/read-types';

const result: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination', modelVersion: 'stub-1', isStub: true,
};

beforeEach(() => jest.clearAllMocks());

test('recordScan calls the record_scan RPC with the camelCase score map', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await recordScan(result);
  expect(mockRpc).toHaveBeenCalledWith('record_scan', {
    p_scores: result.scores, p_skin_type: 'combination', p_model_version: 'stub-1', p_is_stub: true,
  });
});
test('recordScan throws on RPC error', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'boom' } });
  await expect(recordScan(result)).rejects.toThrow('record-scan-failed');
});
test('fetchLatestScan reassembles snake_case columns into a ScoreVector', async () => {
  const row = {
    id: 's1', captured_at: '2026-06-16T00:00:00Z', skin_type_feel: 'combination',
    model_version: 'stub-1', is_stub: true,
    score_hydration: 0.5, score_oiliness: 0.5, score_texture: 0.5, score_pores: 0.5,
    score_dark_spots: 0.5, score_redness: 0.5, score_fine_lines: 0.5, score_dark_circles: 0.5,
  };
  mockFrom.mockReturnValue({
    select: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  });
  const scan = await fetchLatestScan();
  expect(scan?.scores.darkSpots).toBe(0.5);
  expect(Object.keys(scan!.scores)).toHaveLength(DIMENSIONS.length);
});
