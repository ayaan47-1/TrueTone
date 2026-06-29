import { GlassCard } from './GlassCard';
import { Caption } from './Typography';

/**
 * The standing cosmetic / not-a-medical-device disclaimer. Single source of truth
 * for this compliance copy (CLAUDE.md §0/§1) so every surface that shows it stays
 * identical. Reachable from Today and You.
 */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <GlassCard flat intensity={24} radius={26} className={`px-5 py-4 ${className ?? ''}`}>
      <Caption className="text-[11px] leading-[17px] text-ink-muted">
        TrueTone is a cosmetic and general-wellness tool. It is not a medical device, does not
        diagnose, treat, or prevent any disease or condition, and is not a substitute for
        professional medical advice. Results are AI-generated estimates of your skin&rsquo;s
        appearance. For any skin concern &mdash; or any new, changing, or unusual spot &mdash;
        please consult a board-certified dermatologist.
      </Caption>
    </GlassCard>
  );
}
