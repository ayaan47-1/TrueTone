import { Pressable, View, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Caption } from './Typography';
import { useInsets } from './use-insets';
import { palette, softShadow } from '../../theme/tokens';
import { TodayGlyph, RoutineGlyph, TrendGlyph, YouGlyph, ScanGlyph, type GlyphProps } from './tab-icons';

/** Route keys for the four real tab screens (the center Scan is a separate action). */
export type TabKey = 'index' | 'routine' | 'trend' | 'you';

/**
 * Bottom space a scrollable tab screen should reserve so its last content clears
 * the floating bar (bar height + the protruding Scan button + breathing room +
 * typical bottom inset). Single source of truth — tune once, here. */
export const TAB_BAR_CLEARANCE = 120;

interface TabDef {
  key: TabKey;
  label: string;
  Glyph: (props: GlyphProps) => React.ReactElement;
}

// Order matches the bar; the center Scan button is injected between routine and trend.
const LEFT: readonly TabDef[] = [
  { key: 'index', label: 'Today', Glyph: TodayGlyph },
  { key: 'routine', label: 'Routine', Glyph: RoutineGlyph },
];
const RIGHT: readonly TabDef[] = [
  { key: 'trend', label: 'Trend', Glyph: TrendGlyph },
  { key: 'you', label: 'You', Glyph: YouGlyph },
];

const ACTIVE = palette.mauve600;
const INACTIVE = palette.inkMuted;

interface GlassTabBarProps {
  /** The currently focused tab route key. */
  activeKey: string;
  /** Navigate to a tab. */
  onSelect: (key: TabKey) => void;
  /** Open the full-screen capture flow (center button). */
  onScanPress: () => void;
}

/**
 * Floating frosted tab bar for the main app. Four destinations flank an elevated
 * center "Scan" button that pushes the full-screen camera route (which lives
 * outside the tab navigator). Purely presentational — the route adapter in
 * `app/(tabs)/_layout.tsx` maps React Navigation state onto this API.
 */
export function GlassTabBar({ activeKey, onSelect, onScanPress }: GlassTabBarProps) {
  const insets = useInsets();
  return (
    <View style={[styles.dock, { paddingBottom: insets.bottom + 10, pointerEvents: 'box-none' }]}>
      <GlassCard
        intensity={42}
        radius={30}
        className="px-3 pt-2.5 pb-3.5 flex-row items-center"
        style={styles.pill}
      >
        {LEFT.map((t) => (
          <TabButton key={t.key} def={t} active={activeKey === t.key} onPress={() => onSelect(t.key)} />
        ))}

        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan"
            onPress={onScanPress}
            style={styles.scanButton}
            hitSlop={8}
          >
            <ScanGlyph color={palette.white} size={26} />
          </Pressable>
          <Caption style={styles.centerLabel}>Scan</Caption>
        </View>

        {RIGHT.map((t) => (
          <TabButton key={t.key} def={t} active={activeKey === t.key} onPress={() => onSelect(t.key)} />
        ))}
      </GlassCard>
    </View>
  );
}

function TabButton({ def, active, onPress }: { def: TabDef; active: boolean; onPress: () => void }) {
  const color = active ? ACTIVE : INACTIVE;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={def.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={6}
      style={styles.tab}
    >
      <def.Glyph color={color} size={22} />
      <Caption numberOfLines={1} style={[styles.label, { color }]}>
        {def.label}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  // Fill the available width up to a cap so the flex tabs distribute evenly and the
  // pill stays centered (not edge-to-edge) on wide/unfolded screens.
  pill: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10, letterSpacing: 0.2 },
  centerSlot: { width: 64, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.mauve500,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    ...softShadow,
  },
  centerLabel: { fontSize: 10, letterSpacing: 0.2, color: palette.mauve600 },
});
