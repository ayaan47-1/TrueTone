import { Pressable, View, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Caption } from './Typography';
import { useInsets } from './use-insets';
import { palette } from '../../theme/tokens';
import { TodayGlyph, ShopGlyph, CommunityGlyph, YouGlyph, type GlyphProps } from './tab-icons';

/**
 * Route keys for the four tab screens. `index` is Home, the landing destination, and sits
 * first. The shade-match ("Shade match") scan entry is NOT a tab — it lives as a small
 * icon in the Home header, which pushes the pre-camera privacy gate (`/scan-gate`).
 */
export type TabKey = 'shop' | 'index' | 'community' | 'you';

interface TabDef {
  key: TabKey;
  label: string;
  Glyph: (props: GlyphProps) => React.ReactElement;
}

// Order matches the bar, left→right. Home leads as the landing destination; the
// former center "Shade match" action has been removed (it now lives in the Home header).
const TABS: readonly TabDef[] = [
  { key: 'index', label: 'Home', Glyph: TodayGlyph },
  { key: 'shop', label: 'Shop', Glyph: ShopGlyph },
  { key: 'community', label: 'Community', Glyph: CommunityGlyph },
  { key: 'you', label: 'Account', Glyph: YouGlyph },
];

const ACTIVE = palette.sage;
const INACTIVE = palette.inkMuted;

interface GlassTabBarProps {
  /** The currently focused tab route key. */
  activeKey: string;
  /** Navigate to a tab. */
  onSelect: (key: TabKey) => void;
}

/**
 * Quiet Glass fallback tab bar (iOS < 26, Android, web) — iOS 26+ uses the native Liquid
 * Glass UITabBar instead (see app/(tabs)/_layout.tsx). Floating frosted tab bar for the main app: four evenly-spaced destinations
 * (Home · Shop · Community · Account). Purely presentational — the route adapter in
 * `app/(tabs)/_layout.tsx` maps React Navigation state onto this API.
 */
export function GlassTabBar({ activeKey, onSelect }: GlassTabBarProps) {
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
          {TABS.map((t) => (
            <TabButton key={t.key} def={t} active={activeKey === t.key} onPress={() => onSelect(t.key)} />
          ))}
        </GlassCard>
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
  // pill stays centered (not edge-to-edge) on wide/unfolded screens.
  stack: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  pill: { width: '100%' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10, letterSpacing: 0.2 },
});
