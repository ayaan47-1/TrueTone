// run-read.ts now statically imports lib/scans and age/skin-age-engine; mock both to
// prevent Supabase/AsyncStorage from loading in the test environment.
jest.mock('../../../lib/scans', () => ({ recordScan: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../age/skin-age-engine', () => ({ estimateSkinAge: jest.fn().mockReturnValue(null) }));

// HAG-231, Toby review finding 1: controllable E2E force-fail seam for the default persist
// path (see src/lib/e2e-force-persist-failure.ts).
let mockForcePersistFailure = false;
jest.mock('../../../lib/e2e-force-persist-failure', () => ({
  get E2E_FORCE_PERSIST_FAILURE() {
    return mockForcePersistFailure;
  },
}));

// HAG-231, Dwight review fix (c): under the E2E fixture flag, a failure must propagate loudly
// instead of silently substituting stubRead() (see src/lib/e2e-fixture.ts).
let mockFixtureScan = false;
jest.mock('../../../lib/e2e-fixture', () => ({
  get E2E_FIXTURE_SCAN() {
    return mockFixtureScan;
  },
}));

import { runRead } from '../run-read';
import type { ReadEngine } from '../read-engine';
import type { ReadResult } from '../read-types';
import { personalization } from '../../session/personalization';
import { deriveShade, deriveToneFromLab } from '../../shade/derive-shade';
import { recordScan } from '../../../lib/scans';

beforeEach(() => {
  personalization.reset();
  mockForcePersistFailure = false;
  mockFixtureScan = false;
  (recordScan as jest.Mock).mockClear();
});

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

test('publishes the derived shade to personalization when the engine returns a tone', async () => {
  const withTone: ReadResult = { ...fakeResult, tone: { L: 60, a: 12, b: 18 } };
  const engine: ReadEngine = { run: async () => withTone };
  await runRead('file:///tmp/face.jpg', { engine, persist: async () => {} });
  const expected = deriveShade({
    ...deriveToneFromLab(withTone.tone!),
    skinType: withTone.skinType,
    oiliness: withTone.scores.oiliness,
  });
  expect(personalization.getState().currentShade).toEqual(expected);
});

test('leaves currentShade null when the engine result has no tone (stub/no-CV read)', async () => {
  const engine: ReadEngine = { run: async () => fakeResult };
  await runRead('file:///tmp/face.jpg', { engine, persist: async () => {} });
  expect(personalization.getState().currentShade).toBeNull();
});

test('propagates engine failure (no silent swallow outside dev fallback)', async () => {
  const engine: ReadEngine = { run: async () => { throw new Error('read failed'); } };
  // __DEV__ is true under jest-expo, so the dev fallback persists a stub instead of throwing.
  const persisted: ReadResult[] = [];
  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });
  expect(persisted).toHaveLength(1);
  expect(persisted[0].isStub).toBe(true);
});

// HAG-231, Toby review finding 1: the default persist path (no deps.persist override) is what
// app/scan/index.tsx actually uses, and it's the one Maestro flow 2 exercises end to end.
test('default persist path calls through to recordScan when not forced to fail', async () => {
  const engine: ReadEngine = { run: async () => fakeResult };
  await runRead('file:///tmp/face.jpg', { engine });
  expect(recordScan).toHaveBeenCalledTimes(1);
});

test('HAG-231 Toby finding 1: forced persistence failure publishes the shade but never saves it', async () => {
  // This is the exact race the review flagged: run-read.ts calls personalization.setScan(shade)
  // BEFORE awaiting persist(), so a flow that only checks the result screen can pass even when
  // the save afterwards fails. Proving that here is what justifies Maestro flow 2's added
  // "revisit scan history" assertion -- if recordScan never ran, that assertion correctly fails.
  mockForcePersistFailure = true;
  const withTone: ReadResult = { ...fakeResult, tone: { L: 60, a: 12, b: 18 } };
  const engine: ReadEngine = { run: async () => withTone };

  await expect(runRead('file:///tmp/face.jpg', { engine })).rejects.toThrow();

  expect(personalization.getState().currentShade).not.toBeNull();
  expect(recordScan).not.toHaveBeenCalled();
});

// HAG-231, Dwight review fix (c): under E2E_FIXTURE_SCAN, a decode/engine failure must fail
// loudly (propagate), never silently substitute stubRead() -- the exact "flow could pass on a
// broken image" risk the review flagged, closed at the source rather than only via the
// committed fixture's own provenance pinning.
test('HAG-231 Dwight fix (c): under the fixture flag, engine failure propagates instead of falling back to stubRead()', async () => {
  mockFixtureScan = true;
  const engine: ReadEngine = { run: async () => { throw new Error('decode failed'); } };
  const persisted: ReadResult[] = [];

  // __DEV__ is true under jest-expo -- without the fixture-flag gate this would silently
  // persist a stub and resolve; with it, the failure must come through instead.
  await expect(
    runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } }),
  ).rejects.toThrow('decode failed');

  expect(persisted).toHaveLength(0);
});

test('HAG-231 Dwight fix (c): the ordinary __DEV__ stub fallback is unaffected when the fixture flag is off', async () => {
  mockFixtureScan = false;
  const engine: ReadEngine = { run: async () => { throw new Error('read failed'); } };
  const persisted: ReadResult[] = [];

  await runRead('file:///tmp/face.jpg', { engine, persist: async (r) => { persisted.push(r); } });

  expect(persisted).toHaveLength(1);
  expect(persisted[0].isStub).toBe(true);
});
