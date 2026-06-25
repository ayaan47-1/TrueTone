jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ error: null }) },
}));
// Mock path adjusted to match the real import in scans.ts:
// scans.ts imports buildRoutine from '../features/recommend/routine-engine'
jest.mock('../../features/recommend/routine-engine', () => ({
  buildRoutine: () => ({ version: 'r1', am: [], pm: [], notes: [] }),
}));

import { recordScan } from '../scans';
import { supabase } from '../supabase';
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../../features/read/read-types';

const read: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination',
  modelVersion: 'stub-1',
  isStub: true,
};

beforeEach(() => (supabase.rpc as jest.Mock).mockClear());

test('records null skin-age params when no estimate is provided (dark default)', async () => {
  await recordScan(read);
  const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(args.p_skin_age).toBeNull();
  expect(args.p_skin_age_confidence).toBeNull();
});

test('forwards a provided skin-age estimate to the RPC', async () => {
  await recordScan(read, { ageEstimate: 31, confidence: 0.7, modelVersion: 'age-1' });
  const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(args.p_skin_age).toBe(31);
  expect(args.p_skin_age_confidence).toBe(0.7);
});
