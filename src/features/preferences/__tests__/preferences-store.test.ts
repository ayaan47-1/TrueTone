import { createPreferencesStore } from '../preferences-store';
import type { SetupAnswers } from '../preferences-types';

describe('preferencesStore', () => {
  it('starts empty then round-trips structured answers', () => {
    const store = createPreferencesStore();
    expect(store.get()).toBeNull();
    const answers: SetupAnswers = { goals: ['even_base', 'natural_glow'], coverage: 'light', skips: ['heavy_shimmer'] };
    store.set(answers);
    expect(store.get()).toEqual(answers);
  });
  it('stores an immutable copy', () => {
    const store = createPreferencesStore();
    const goals = ['good_lip'] as const;
    store.set({ goals: [...goals], coverage: 'everyday', skips: [] });
    expect(store.get()?.goals).toEqual(['good_lip']);
  });
});
