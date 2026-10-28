// src/features/foryou/RecentMatchesCard.tsx
// "Your recent matches" (Dwight ruling, shade-history-ruling.md §3). A LOG of the shades we
// matched the user to, shown as words with a date — never a measurement of the user over time.
// The shade map is uncalibrated, so: no graph, no number, no "changed / shifted / warmer" wording,
// no accuracy or confidence figure. Labels only; nothing image-shaped (CLAUDE.md §3).
import { View } from 'react-native';
import { GlassCard, Subheading, Body, Caption } from '../../components/ui';
import { formatShadeMatch } from '../shade/shade-history';
import { RECENT_MATCHES_LIMIT, type RecentMatchesState } from './use-recent-shade-matches';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentMatchesCard({ state }: { state: RecentMatchesState }) {
  if (state.status === 'loading') return null;
  return (
    <View className="gap-3" testID="recent-matches">
      <View className="gap-0.5">
        <Subheading accessibilityRole="header">Your recent matches</Subheading>
        <Caption className="text-ink-muted">Shades we matched you to</Caption>
      </View>
      <GlassCard className="gap-3 p-5" flat>
        {state.status === 'error' ? (
          <Body className="text-ink-soft" testID="recent-matches-error">
            Your recent matches couldn’t load right now.
          </Body>
        ) : state.matches.length === 0 ? (
          <Body className="text-ink-soft" testID="recent-matches-empty">
            No saved matches yet. Your matched shades will appear here after a shade match.
          </Body>
        ) : (
          state.matches.slice(0, RECENT_MATCHES_LIMIT).map((m) => (
            <View key={m.id} testID="recent-match-row" className="flex-row items-center justify-between gap-3">
              <Body testID="recent-match-shade" className="flex-1">{formatShadeMatch(m.shade)}</Body>
              <Caption className="text-ink-muted">{formatDate(m.capturedAt)}</Caption>
            </View>
          ))
        )}
      </GlassCard>
    </View>
  );
}
