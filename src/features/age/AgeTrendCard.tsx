// src/features/age/AgeTrendCard.tsx
import React from 'react';
import { GlassCard, Display, Body, Caption } from '../../components/ui';
import { computeSkinFreshnessTrend } from './skin-age-trend';
import { trendCopy } from './age-copy';
import { hasAgeAccess } from '../premium/entitlement';
import { SKIN_AGE_ABSOLUTE_ENABLED } from './age-flags';
import type { ScoreSnapshot } from './age-types';

export function AgeTrendCard({ history, skinAge }: { history: ScoreSnapshot[]; skinAge: number | null }) {
  if (!hasAgeAccess()) {
    return (
      <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
        <Display className="text-xl mb-1">Skin over time</Display>
        <Body className="text-[13px] text-ink-soft">
          Unlock TrueTone Premium to track how your skin looks over time.
        </Body>
      </GlassCard>
    );
  }
  const trend = computeSkinFreshnessTrend(history);
  const { headline, sub } = trendCopy(trend);
  const showAbsolute = SKIN_AGE_ABSOLUTE_ENABLED && skinAge != null;
  return (
    <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
      <Display className="text-xl mb-1">{headline}</Display>
      <Body className="text-[13px] text-ink-soft">{sub}</Body>
      {showAbsolute ? (
        <Body className="text-[13px] text-ink-soft mt-2">Your skin looks like ~{skinAge}.</Body>
      ) : null}
      <Caption className="text-[11px] leading-[16px] mt-2">
        This describes how your skin looks over time, not a medical or biological age.
      </Caption>
    </GlassCard>
  );
}
