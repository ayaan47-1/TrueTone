import { DURATION, SPRING, STAGGER_MS, STAGGER_MAX, ENTER_OFFSET, staggerDelay } from '../motion';

describe('motion tokens', () => {
  it('keeps durations calm (nothing longer than 320ms)', () => {
    expect(DURATION.quick).toBe(180);
    expect(DURATION.base).toBe(240);
    expect(DURATION.slow).toBe(320);
    Object.values(DURATION).forEach((d) => expect(d).toBeLessThanOrEqual(320));
  });

  it('uses a spring that settles without bounce', () => {
    // High damping relative to stiffness => no visible overshoot.
    expect(SPRING.damping).toBe(18);
    expect(SPRING.stiffness).toBe(180);
    expect(SPRING.mass).toBe(0.9);
  });

  it('keeps entrance travel short', () => {
    expect(ENTER_OFFSET).toBe(16);
  });
});

describe('staggerDelay', () => {
  it('spaces successive items by STAGGER_MS', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(STAGGER_MS);
    expect(staggerDelay(3)).toBe(3 * STAGGER_MS);
  });

  it('caps the delay so long lists do not cascade slowly', () => {
    expect(staggerDelay(STAGGER_MAX)).toBe(STAGGER_MAX * STAGGER_MS);
    expect(staggerDelay(STAGGER_MAX + 5)).toBe(STAGGER_MAX * STAGGER_MS);
    expect(staggerDelay(99)).toBe(STAGGER_MAX * STAGGER_MS);
  });

  it('treats negative indexes as zero', () => {
    expect(staggerDelay(-3)).toBe(0);
  });
});
