// src/features/feedback/__tests__/types.test.ts
import { ROUTINE_HELPFUL, isRoutineHelpful } from '../types';

test('the routine-feedback vocabulary is the three approved values', () => {
  expect([...ROUTINE_HELPFUL]).toEqual(['helped', 'no_change', 'worse']);
});
test('isRoutineHelpful narrows only approved values', () => {
  expect(isRoutineHelpful('helped')).toBe(true);
  expect(isRoutineHelpful('cured')).toBe(false);
  expect(isRoutineHelpful(1)).toBe(false);
});
