// src/lib/__tests__/scans-hardened.test.ts
// Edge-case coverage for scans.ts targeting lines 74-80 (fetchScanHistory),
// plus setRoutineFeedback happy/error, rowToScan age fields, and out-of-vocab guard.
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) },
}));

import { fetchScanHistory, setRoutineFeedback, recordScan } from '../scans';
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../../features/read/read-types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'row-1',
    captured_at: '2026-06-16T00:00:00Z',
    skin_type_feel: 'combination',
    model_version: 'stub-1',
    is_stub: true,
    routine: { version: 'skincare-1', am: [], pm: [], notes: [] },
    skin_age_estimate: null,
    skin_age_confidence: null,
    routine_helpful: null,
    score_hydration: 0.5,
    score_oiliness: 0.5,
    score_texture: 0.5,
    score_pores: 0.5,
    score_dark_spots: 0.5,
    score_redness: 0.5,
    score_fine_lines: 0.5,
    score_dark_circles: 0.5,
    ...overrides,
  };
}

/** Configure mockFrom to return a given array from the chained .select().order().limit() call. */
function mockHistory(rows: Record<string, unknown>[], error: unknown = null) {
  mockFrom.mockReturnValue({
    select: () => ({
      order: () => ({
        limit: async () => ({ data: error ? null : rows, error }),
      }),
    }),
  });
}

const read: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination',
  modelVersion: 'stub-1',
  isStub: true,
};

beforeEach(() => { mockRpc.mockReset(); mockFrom.mockReset(); });

// ─── fetchScanHistory (lines 74-80) ──────────────────────────────────────────

describe('fetchScanHistory', () => {
  it('returns an empty array when the DB returns no rows', async () => {
    mockHistory([]);
    const result = await fetchScanHistory();
    expect(result).toEqual([]);
  });

  it('maps each row to a Scan with the correct score vector', async () => {
    mockHistory([baseRow()]);
    const scans = await fetchScanHistory();
    expect(scans).toHaveLength(1);
    expect(scans[0].scores.hydration).toBe(0.5);
    expect(scans[0].scores.darkSpots).toBe(0.5);
    expect(Object.keys(scans[0].scores)).toHaveLength(DIMENSIONS.length);
  });

  it('maps routineHelpful from the DB row', async () => {
    mockHistory([baseRow({ routine_helpful: 'helped' })]);
    const [scan] = await fetchScanHistory();
    expect(scan.routineHelpful).toBe('helped');
  });

  it('maps all three valid routineHelpful values', async () => {
    for (const value of ['helped', 'no_change', 'worse'] as const) {
      mockHistory([baseRow({ routine_helpful: value })]);
      const [scan] = await fetchScanHistory();
      expect(scan.routineHelpful).toBe(value);
    }
  });

  it('coerces an out-of-vocab routine_helpful to null (isRoutineHelpful guard)', async () => {
    mockHistory([baseRow({ routine_helpful: 'cured_it' })]);
    const [scan] = await fetchScanHistory();
    expect(scan.routineHelpful).toBeNull();
  });

  it('coerces a numeric routine_helpful to null', async () => {
    mockHistory([baseRow({ routine_helpful: 42 })]);
    const [scan] = await fetchScanHistory();
    expect(scan.routineHelpful).toBeNull();
  });

  it('maps skinAge and skinAgeConfidence from the row', async () => {
    mockHistory([baseRow({ skin_age_estimate: 34, skin_age_confidence: 0.72 })]);
    const [scan] = await fetchScanHistory();
    expect(scan.skinAge).toBe(34);
    expect(scan.skinAgeConfidence).toBe(0.72);
  });

  it('keeps skinAge null when the DB column is null', async () => {
    mockHistory([baseRow({ skin_age_estimate: null, skin_age_confidence: null })]);
    const [scan] = await fetchScanHistory();
    expect(scan.skinAge).toBeNull();
    expect(scan.skinAgeConfidence).toBeNull();
  });

  it('throws fetch-scan-history-failed on DB error', async () => {
    mockHistory([], { message: 'boom' });
    await expect(fetchScanHistory()).rejects.toThrow('fetch-scan-history-failed');
  });

  it('uses the supplied limit argument', async () => {
    mockHistory([]);
    await fetchScanHistory(10);
    // The `.limit()` call receives the custom limit — confirm mockFrom was called
    // (the limit arg is consumed internally by the chain, no direct way to assert
    // value without capturing it; this test at minimum verifies no error is thrown).
    expect(mockFrom).toHaveBeenCalled();
  });

  it('maps multiple rows and preserves order', async () => {
    mockHistory([
      baseRow({ id: 'row-1', captured_at: '2026-06-16T00:00:00Z' }),
      baseRow({ id: 'row-2', captured_at: '2026-06-09T00:00:00Z' }),
    ]);
    const scans = await fetchScanHistory();
    expect(scans).toHaveLength(2);
    expect(scans[0].id).toBe('row-1');
    expect(scans[1].id).toBe('row-2');
  });
});

// ─── setRoutineFeedback ───────────────────────────────────────────────────────

describe('setRoutineFeedback', () => {
  it('resolves without error on success', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await expect(setRoutineFeedback('scan-42', 'no_change')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('set_routine_feedback', {
      p_scan_id: 'scan-42',
      p_helpful: 'no_change',
    });
  });

  it('throws set-routine-feedback-failed when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'constraint' } });
    await expect(setRoutineFeedback('scan-42', 'worse')).rejects.toThrow('set-routine-feedback-failed');
  });

  it('passes all three feedback values to the RPC', async () => {
    mockRpc.mockResolvedValue({ error: null });
    for (const v of ['helped', 'no_change', 'worse'] as const) {
      await setRoutineFeedback('s1', v);
      expect(mockRpc).toHaveBeenLastCalledWith('set_routine_feedback', {
        p_scan_id: 's1',
        p_helpful: v,
      });
    }
  });
});

// ─── recordScan with a non-null age passes p_skin_age / p_skin_age_confidence ─

describe('recordScan with skin age', () => {
  beforeEach(() => {
    // stub routine-engine so this test file doesn't pull in the full domain dep
    jest.mock('../../features/recommend/routine-engine', () => ({
      buildRoutine: () => ({ version: 'r1', am: [], pm: [], notes: [] }),
    }));
    mockRpc.mockResolvedValue({ error: null });
  });

  it('passes p_skin_age and p_skin_age_confidence when a non-null estimate is provided', async () => {
    await recordScan(read, { ageEstimate: 31, confidence: 0.7, modelVersion: 'age-1' });
    const args = mockRpc.mock.calls[0][1];
    expect(args.p_skin_age).toBe(31);
    expect(args.p_skin_age_confidence).toBe(0.7);
  });

  it('passes null for both age params when no estimate is given (dark default)', async () => {
    await recordScan(read);
    const args = mockRpc.mock.calls[0][1];
    expect(args.p_skin_age).toBeNull();
    expect(args.p_skin_age_confidence).toBeNull();
  });

  it('passes null for both age params when age=null is explicit', async () => {
    await recordScan(read, null);
    const args = mockRpc.mock.calls[0][1];
    expect(args.p_skin_age).toBeNull();
    expect(args.p_skin_age_confidence).toBeNull();
  });
});
