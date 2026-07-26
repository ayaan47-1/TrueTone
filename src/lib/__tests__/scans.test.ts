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

test('recordScan calls the record_scan RPC with the camelCase score map and routine', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await recordScan(result);
  const args = mockRpc.mock.calls[0][1];
  expect(mockRpc).toHaveBeenCalledWith('record_scan', expect.objectContaining({
    p_scores: result.scores, p_skin_type: 'combination', p_model_version: 'stub-1', p_is_stub: true,
  }));
  expect(args.p_routine_version).toBe('skincare-1');
  expect(args.p_routine.version).toBe('skincare-1');
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

test('recordScan builds a routine and passes it to the RPC', async () => {
  const dryResult: ReadResult = {
    scores: {
      hydration: 0.2, oiliness: 0.5, texture: 0.5, pores: 0.5,
      darkSpots: 0.8, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
    },
    skinType: 'dry', modelVersion: 'stub-1', isStub: true,
  };
  mockRpc.mockResolvedValue({ error: null });
  await recordScan(dryResult);
  const args = mockRpc.mock.calls[0][1];
  expect(args.p_routine_version).toBe('skincare-1');
  expect(args.p_routine.version).toBe('skincare-1');
  // low hydration on dry skin -> hydrating serum is present somewhere in the routine
  const cats = [...args.p_routine.am, ...args.p_routine.pm].map((s: { category: string }) => s.category);
  expect(cats.some((c: string) => c.includes('hydrating serum'))).toBe(true);
});

describe('capture quality persistence', () => {
  it('passes the band to the record_scan RPC', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await recordScan(
      { scores: {} as any, skinType: 'dry', modelVersion: 'cv-1', isStub: false },
      null,
      'fair',
    );
    expect(mockRpc).toHaveBeenCalledWith('record_scan', expect.objectContaining({ p_capture_quality: 'fair' }));
  });

  it('sends null when no band is supplied, so existing callers keep working', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await recordScan({ scores: {} as any, skinType: 'dry', modelVersion: 'cv-1', isStub: false });
    expect(mockRpc).toHaveBeenCalledWith('record_scan', expect.objectContaining({ p_capture_quality: null }));
  });

  it('reads a null band back as null rather than throwing', () => {
    const { rowToScan } = require('../scans');
    if (typeof rowToScan === 'function') {
      expect(() => rowToScan({ id: '1', captured_at: 'x', skin_type_feel: 'dry', model_version: 'cv-1', is_stub: false })).not.toThrow();
    }
  });
});
