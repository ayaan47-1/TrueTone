import { View } from 'react-native';

/**
 * Minimal geometric tab glyphs drawn with Views — the app ships no icon font, and
 * these stay consistent with the existing dot/swatch motif of the "Mist" system.
 * Each takes a `color` (active = mauve, inactive = ink-muted) and renders inside a
 * square box so the tab bar can align them on a single baseline.
 */
export interface GlyphProps {
  color: string;
  size?: number;
}

function Box({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

/** Today — a soft sun ring. */
export function TodayGlyph({ color, size = 22 }: GlyphProps) {
  const d = size * 0.62;
  return (
    <Box size={size}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: color }} />
    </Box>
  );
}

/** Routine — a three-step checklist. */
export function RoutineGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', gap: size * 0.16 }}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.16 }}>
          <View
            style={{ width: size * 0.16, height: size * 0.16, borderRadius: 99, backgroundColor: color }}
          />
          <View style={{ flex: 1, height: 2, borderRadius: 2, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}

/** Shop — a simple shopping bag with a handle. */
export function ShopGlyph({ color, size = 22 }: GlyphProps) {
  const w = size * 0.66;
  const h = size * 0.56;
  const handle = w * 0.42;
  return (
    <Box size={size}>
      {/* handle arc */}
      <View
        style={{
          width: handle,
          height: handle * 0.6,
          borderTopLeftRadius: handle,
          borderTopRightRadius: handle,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
          marginBottom: -1,
        }}
      />
      {/* bag body */}
      <View
        style={{
          width: w,
          height: h,
          borderRadius: size * 0.14,
          borderWidth: 2,
          borderColor: color,
        }}
      />
    </Box>
  );
}

/** Trend — three ascending bars. */
export function TrendGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: size * 0.08,
      }}
    >
      {[0.42, 0.68, 1].map((h) => (
        <View
          key={h}
          style={{ width: size * 0.18, height: size * 0.78 * h, borderRadius: 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

/** You — a head-and-shoulders person mark. */
export function YouGlyph({ color, size = 22 }: GlyphProps) {
  const head = size * 0.34;
  return (
    <Box size={size}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          borderWidth: 2,
          borderColor: color,
          marginBottom: size * 0.06,
        }}
      />
      <View
        style={{
          width: size * 0.66,
          height: size * 0.34,
          borderTopLeftRadius: size * 0.33,
          borderTopRightRadius: size * 0.33,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </Box>
  );
}

/** Scan — a rounded capture frame (used inside the elevated center button). */
export function ScanGlyph({ color, size = 24 }: GlyphProps) {
  const s = size * 0.66;
  return (
    <Box size={size}>
      <View style={{ width: s, height: s, borderRadius: s * 0.3, borderWidth: 2, borderColor: color }} />
    </Box>
  );
}
