import { findDiseaseTerms } from '../../lib/cosmetic-filter';
import type { SkinAgeTrend } from './age-types';

// Fail-closed self-check: these strings are hand-written and cosmetic, but we still refuse to ship
// any string that trips the disease blocklist (CLAUDE.md §1), so a careless future edit can't leak.
export function assertTrendCopySafe(text: string): void {
  const bad = findDiseaseTerms(text);
  if (bad.length) throw new Error(`blocked disease term in trend copy: ${bad.join(', ')}`);
}

export function trendCopy(trend: SkinAgeTrend): { headline: string; sub: string } {
  if (trend.sampleCount < 2) {
    const copy = {
      headline: 'Your skin trend',
      sub: 'Scan again over the next few weeks to see how your skin looks over time.',
    };
    assertTrendCopySafe(copy.headline);
    assertTrendCopySafe(copy.sub);
    return copy;
  }
  const map: Record<SkinAgeTrend['direction'], { headline: string; sub: string }> = {
    fresher: {
      headline: 'Your skin looks fresher',
      sub: 'Compared with your recent scans, your skin is looking more rested and hydrated.',
    },
    steady: {
      headline: 'Your skin looks steady',
      sub: 'Your skin looks about the same as your recent scans — no notable change.',
    },
    'more-tired': {
      headline: 'Your skin looks more tired',
      sub: 'Compared with your recent scans, your skin looks a little more tired lately.',
    },
  };
  const copy = map[trend.direction];
  assertTrendCopySafe(copy.headline);
  assertTrendCopySafe(copy.sub);
  return copy;
}
