import { Pressable, View, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Caption } from './Typography';
import { useInsets } from './use-insets';
import { glass, palette, softShadow } from '../../theme/tokens';
import { TodayGlyph, RoutineGlyph, TrendGlyph, YouGlyph, ScanGlyph, type GlyphProps } from './tab-icons';

/** Route keys for the four real tab screens (the center Scan is a separate action). */
export type TabKey = 'index' | 'routine' | 'trend' | 'you';

/**
 * Bottom space a scrollable tab screen should reserve so its last content clears
 * the floating bar (bar height + the protruding Scan button + breathing room +
 * typical bottom inset). Single source of truth — tune once, here. */
export const TAB_BAR_CLEARANCE = 120;

/** Diameter of the floating Scan button. */
const SCAN_SIZE = 52;
/** How far it rises above the pill's top edge. */
const SCAN_PROTRUSION = 20;
/** Height the other tabs' glyphs occupy, mirrored by the center slot's spacer. */
const SCAN_ICON_SLOT = 22;

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

const ACTIVE = palette.sage;
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
      <View style={styles.stack} pointerEvents="box-none">
        <GlassCard
          intensity={42}
          radius={24}
          className="px-3 pt-2.5 pb-3.5 flex-row items-center"
          style={styles.pill}
        >
          {LEFT.map((t) => (
            <TabButton key={t.key} def={t} active={activeKey === t.key} onPress={() => onSelect(t.key)} />
          ))}

          {/* Reserves the center column and carries the label. The button itself floats above
              (see below) — the icon-sized spacer keeps this label on the same baseline as the
              other four. */}
          <View style={styles.centerSlot}>
            <View style={styles.centerIconSpacer} />
            <Caption numberOfLines={1} style={styles.centerLabel}>
              Scan
            </Caption>
          </View>

          {RIGHT.map((t) => (
            <TabButton key={t.key} def={t} active={activeKey === t.key} onPress={() => onSelect(t.key)} />
          ))}
        </GlassCard>

        {/* Deliberately a sibling of the pill, not a child: GlassCard clips its blurred surface
            with overflow:'hidden', so an elevated button that protrudes from inside it gets cut
            off and (on Android) makes the surface itself render as an unclipped box. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan"
          onPress={onScanPress}
          style={styles.scanButton}
          hitSlop={8}
        >
          <ScanGlyph color={palette.white} size={26} />
        </Pressable>
      </View>
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
  // pill stays centered (not edge-to-edge) on wide/unfolded screens. `stack` is the
  // positioning context the floating Scan button anchors to.
  stack: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  // This is the only elevated GlassCard in the app. Android builds an elevated view's shadow from
  // its outline, and derives that outline from the background drawable — with a transparent
  // background it falls back to a rectangle and paints a light box that ignores the radius. Giving
  // the elevated wrapper the glass fill (and clipping it) restores the rounded outline.
  pill: { width: '100%', backgroundColor: glass.fill, borderRadius: 24, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10, letterSpacing: 0.2 },
  centerSlot: { width: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  // Stands in for the glyph the other tabs draw, so every label shares one baseline.
  centerIconSpacer: { height: SCAN_ICON_SLOT },
  scanButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: -SCAN_PROTRUSION,
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.sage,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    ...softShadow,
  },
  centerLabel: { fontSize: 10, letterSpacing: 0.2, color: palette.sageInk },
});
