// src/lib/__tests__/scans-feedback.test.ts
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) },
}));

import { setRoutineFeedback, fetchLatestScan } from '../scans';
import { DIMENSIONS } from '../../content/cosmetic-vocab';

beforeEach(() => { mockRpc.mockReset(); mockFrom.mockReset(); });

test('setRoutineFeedback calls the RPC with the scan id and value', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await setRoutineFeedback('scan-1', 'helped');
  expect(mockRpc).toHaveBeenCalledWith('set_routine_feedback', { p_scan_id: 'scan-1', p_helpful: 'helped' });
});

test('setRoutineFeedback throws a stable error when the RPC errors', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'boom' } });
  await expect(setRoutineFeedback('scan-1', 'worse')).rejects.toThrow('set-routine-feedback-failed');
});

test('rowToScan maps a stored routine_helpful and rejects an out-of-vocab value', async () => {
  const base: Record<string, unknown> = {
    id: 's1', captured_at: '2026-06-16T00:00:00Z', skin_type_feel: 'combination',
    model_version: 'stub-1', is_stub: true, skin_age_estimate: null, skin_age_confidence: null,
    ...Object.fromEntries(DIMENSIONS.map((d) => [`score_${d.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())}`, 0.5])),
  };
  const withRow = (row: Record<string, unknown>) => mockFrom.mockReturnValue({
    select: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  });

  withRow({ ...base, routine_helpful: 'helped' });
  expect((await fetchLatestScan())?.routineHelpful).toBe('helped');

  withRow({ ...base, routine_helpful: 'cured' }); // unexpected DB value -> guarded to null
  expect((await fetchLatestScan())?.routineHelpful).toBeNull();
});
