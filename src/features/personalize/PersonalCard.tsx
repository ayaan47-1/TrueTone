// src/features/personalize/PersonalCard.tsx
// "Compared to your usual" — relative, within-user messaging from the personal baseline.
// Last-line runtime compliance guard: any message containing a blocked term is dropped
// (templates are also statically fuzz-tested; this is defense in depth).
import { GlassCard, Display, Body, Caption } from '../../components/ui';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';

export function PersonalCard({ messages }: { messages: string[] }) {
  const safe = messages.filter((m) => findDiseaseTerms(m).length === 0);
  if (safe.length === 0) return null;
  return (
    <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
      <Display className="text-xl mb-1">Compared to your usual</Display>
      {safe.map((message, i) => (
        <Body key={i} className="text-[13px] text-ink-soft mb-1">
          {message}
        </Body>
      ))}
      <Caption className="text-[11px] leading-[16px] mt-2">
        Relative to your own recent scans — how your skin looks, not a medical read.
      </Caption>
    </GlassCard>
  );
}
