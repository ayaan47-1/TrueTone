// run-read.ts now statically imports lib/scans and age/skin-age-engine; mock both to
// prevent Supabase/AsyncStorage from loading in the test environment.
jest.mock('../../../lib/scans', () => ({ recordScan: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../age/skin-age-engine', () => ({ estimateSkinAge: jest.fn().mockReturnValue(null) }));

import { runRead } from '../run-read';
import type { ReadEngine } from '../read-engine';
import type { ReadResult } from '../read-types';

const fakeResult: ReadResult = {
  scores: {
    hydration: 0.5,
    oiliness: 0.5,
    texture: 0.5,
    pores: 0.5,
    darkSpots: 0.5,
    redness: 0.5,
    fineLines: 0.5,
    darkCircles: 0.5,
  },
  skinType: 'combination',
  modelVersion: 'cv-1',
  isStub: false,
};

test('persists the real engine result', async () => {
  const persisted: ReadResult[] = [];
  const engine: ReadEngine = { run: async () => fakeResult };
  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });
  expect(persisted).toEqual([fakeResult]);
});

test('propagates engine failure (no silent swallow outside dev fallback)', async () => {
  const engine: ReadEngine = { run: async () => { throw new Error('read failed'); } };
  // __DEV__ is true under jest-expo, so the dev fallback persists a stub instead of throwing.
  const persisted: ReadResult[] = [];
  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });
  expect(persisted).toHaveLength(1);
  expect(persisted[0].isStub).toBe(true);
});
