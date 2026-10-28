// src/lib/__tests__/scans-shade.test.ts
// Shade history persistence: labels only cross to the backend, never raw tone numbers.
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) } }));

import { recordScan, fetchScanHistory, fetchRecentShadeMatches, clearShadeHistory } from '../scans';
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../../features/read/read-types';

const result: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'oily', modelVersion: 'cv-1', isStub: false,
};
const baseRow = {
  id: 's1', captured_at: '2026-09-20T10:00:00Z', skin_type_feel: 'oily', model_version: 'cv-1', is_stub: false,
  score_hydration: 0.5, score_oiliness: 0.5, score_texture: 0.5, score_pores: 0.5,
  score_dark_spots: 0.5, score_redness: 0.5, score_fine_lines: 0.5, score_dark_circles: 0.5,
};

beforeEach(() => jest.clearAllMocks());

test('recordScan sends the shade as band words + capture mode', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await recordScan(result, null, 'good', {
    shade: { shadeName: 'Tan Warm', undertone: 'warm', depth: 7, finish: 'satin' },
    captureMode: 'pair',
  });
  const args = mockRpc.mock.calls[0][1];
  expect(args.p_shade).toEqual({ depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' });
  expect(args.p_capture_mode).toBe('pair');
});

test('recordScan without a shade sends nulls (existing callers unchanged)', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await recordScan(result);
  const args = mockRpc.mock.calls[0][1];
  expect(args.p_shade).toBeNull();
  expect(args.p_capture_mode).toBeNull();
});

test('recordScan never sends raw tone numbers or image data', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await recordScan({ ...result, tone: { L: 60, a: 12, b: 18 } }, null, null, {
    shade: { shadeName: 'Tan Warm', undertone: 'warm', depth: 7, finish: 'satin' },
  });
  const sent = JSON.stringify(mockRpc.mock.calls[0][1]);
  expect(sent).not.toMatch(/lightness|warmth|olive"|"depth"|"L"|"(photo)?uri"|file:/i);
});

test('fetchScanHistory maps shade columns onto each scan', async () => {
  const rows = [
    { ...baseRow, shade_depth_band: 'tan', shade_undertone: 'warm', shade_finish: 'satin', shade_name: 'Tan Warm', capture_mode: 'pair' },
    { ...baseRow, id: 's2' },
  ];
  mockFrom.mockReturnValue({ select: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }) });
  const [withShade, without] = await fetchScanHistory();
  expect(withShade.shade).toEqual({ depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' });
  expect(withShade.captureMode).toBe('pair');
  expect(without.shade).toBeNull();
  expect(without.captureMode).toBeNull();
});

test('fetchRecentShadeMatches selects only labelled rows, newest first, limited', async () => {
  const limit = jest.fn(async () => ({
    data: [{ id: 's1', captured_at: '2026-09-20T10:00:00Z', shade_depth_band: 'light', shade_undertone: 'cool',
      shade_finish: 'matte', shade_name: 'Light Cool' }],
    error: null,
  }));
  const order = jest.fn(() => ({ limit }));
  const not = jest.fn(() => ({ order }));
  const select = jest.fn((_cols: string) => ({ not }));
  mockFrom.mockReturnValue({ select });
  const matches = await fetchRecentShadeMatches(5);
  expect(mockFrom).toHaveBeenCalledWith('scans');
  expect(select.mock.calls[0][0]).not.toMatch(/score_|\*/);
  expect(not).toHaveBeenCalledWith('shade_name', 'is', null);
  expect(order).toHaveBeenCalledWith('captured_at', { ascending: false });
  expect(limit).toHaveBeenCalledWith(5);
  expect(matches).toEqual([{ id: 's1', capturedAt: '2026-09-20T10:00:00Z',
    shade: { depthBand: 'light', undertone: 'cool', finish: 'matte', shadeName: 'Light Cool' } }]);
});

test('fetchRecentShadeMatches throws on error', async () => {
  mockFrom.mockReturnValue({ select: () => ({ not: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'x' } }) }) }) }) });
  await expect(fetchRecentShadeMatches()).rejects.toThrow('fetch-shade-history-failed');
});

test('clearShadeHistory calls the clear_shade_history RPC and throws on error', async () => {
  mockRpc.mockResolvedValueOnce({ error: null });
  await clearShadeHistory();
  expect(mockRpc).toHaveBeenCalledWith('clear_shade_history');
  mockRpc.mockResolvedValueOnce({ error: { message: 'x' } });
  await expect(clearShadeHistory()).rejects.toThrow('clear-shade-history-failed');
});
