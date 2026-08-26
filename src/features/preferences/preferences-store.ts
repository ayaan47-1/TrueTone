// src/features/preferences/preferences-store.ts
// On-device store for the structured Setup answers. Backend is injectable so the store
// is testable without AsyncStorage/network; nothing here leaves the device.
import type { SetupAnswers } from './preferences-types';

export interface PreferencesBackend {
  load(): SetupAnswers | null;
  save(answers: SetupAnswers): void;
}

function createMemoryBackend(): PreferencesBackend {
  let value: SetupAnswers | null = null;
  return { load: () => value, save: (a) => { value = a; } };
}

export interface PreferencesStore {
  get(): SetupAnswers | null;
  set(answers: SetupAnswers): SetupAnswers;
}

/** Persist STRUCTURED SetupAnswers (immutable copy in, immutable value out). */
export function createPreferencesStore(
  backend: PreferencesBackend = createMemoryBackend(),
): PreferencesStore {
  return {
    get: () => backend.load(),
    set: (answers) => {
      const next: SetupAnswers = {
        goals: [...answers.goals],
        coverage: answers.coverage,
        skips: [...answers.skips],
      };
      backend.save(next);
      return next;
    },
  };
}

export const preferencesStore = createPreferencesStore();
