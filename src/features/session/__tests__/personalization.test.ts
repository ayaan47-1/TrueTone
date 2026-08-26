import { personalization } from '../personalization';

describe('personalization store', () => {
  beforeEach(() => personalization.reset());

  it('starts un-scanned with no shade', () => {
    expect(personalization.getState()).toEqual({ hasScanned: false, currentShade: null });
  });

  it('setScan flips hasScanned and stores descriptors only (no image field)', () => {
    personalization.setScan({ shadeName: 'Sand 3.5', undertone: 'warm', depth: 4, finish: 'satin' });
    const state = personalization.getState();
    expect(state.hasScanned).toBe(true);
    expect(state.currentShade).toEqual({ shadeName: 'Sand 3.5', undertone: 'warm', depth: 4, finish: 'satin' });
    expect(Object.keys(state.currentShade ?? {})).toEqual(['shadeName', 'undertone', 'depth', 'finish']);
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsub = personalization.subscribe(() => { calls += 1; });
    personalization.setScan({ shadeName: 'X', undertone: 'cool', depth: 2, finish: 'matte' });
    expect(calls).toBe(1);
    unsub();
  });
});
