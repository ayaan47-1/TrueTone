import { toggleGoal } from '../goal-selection';
import type { Goal } from '../../../content/makeup-vocab';

describe('toggleGoal', () => {
  it('adds a goal that is not yet selected', () => {
    expect(toggleGoal([], 'even_base')).toEqual(['even_base']);
  });
  it('removes a goal that is already selected', () => {
    expect(toggleGoal(['even_base', 'natural_glow'], 'even_base')).toEqual(['natural_glow']);
  });
  it('does not mutate the input array', () => {
    const input: Goal[] = ['good_lip'];
    toggleGoal(input, 'all_day_wear');
    expect(input).toEqual(['good_lip']);
  });
  it('accumulates a multi-select in order', () => {
    let sel: Goal[] = [];
    sel = toggleGoal(sel, 'even_base');
    sel = toggleGoal(sel, 'defined_eyes');
    expect(sel).toEqual(['even_base', 'defined_eyes']);
  });
});
