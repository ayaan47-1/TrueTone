import { SKIN_AGE_ABSOLUTE_ENABLED } from '../age-flags';

describe('age feature flags', () => {
  it('keeps the absolute skin-age number dark by default (validation gate)', () => {
    expect(SKIN_AGE_ABSOLUTE_ENABLED).toBe(false);
  });
});
