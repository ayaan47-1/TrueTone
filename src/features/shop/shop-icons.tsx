// src/features/shop/shop-icons.tsx
// Shop glyphs from the v3 kit (SearchG3, PlusG3, CheckG3, ChevG3, TrashG3), built in the
// app's icon vocabulary: plain Views, 2px strokes, no icon font, no image assets.
import { View } from 'react-native';

interface GlyphProps {
  color: string;
  size?: number;
}

export function SearchGlyph({ color, size = 18 }: GlyphProps) {
  return (
    <View testID="glyph-search" style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.72, height: size * 0.72, borderRadius: size, borderWidth: 2, borderColor: color }} />
      <View style={{ position: 'absolute', right: size * 0.02, bottom: size * 0.12, width: size * 0.34, height: 2, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

export function PlusGlyph({ color, size = 12, minus = false }: GlyphProps & { minus?: boolean }) {
  return (
    <View testID={minus ? 'glyph-minus' : 'glyph-plus'} style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: size / 2 - 1, left: 0, width: size, height: 2, borderRadius: 1, backgroundColor: color }} />
      {minus ? null : (
        <View style={{ position: 'absolute', left: size / 2 - 1, top: 0, width: 2, height: size, borderRadius: 1, backgroundColor: color }} />
      )}
    </View>
  );
}

export function CheckGlyph({ color, size = 12 }: GlyphProps) {
  return (
    <View
      testID="glyph-check"
      style={{ width: size, height: size * 0.55, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '-45deg' }, { translateY: -1 }] }}
    />
  );
}

const CHEVRON_ROTATION = { right: '45deg', down: '135deg', left: '-135deg', up: '-45deg' } as const;

export function ChevronGlyph({ color, size = 8, dir = 'right' }: GlyphProps & { dir?: keyof typeof CHEVRON_ROTATION }) {
  return (
    <View
      testID="glyph-chevron"
      style={{ width: size, height: size, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: CHEVRON_ROTATION[dir] }] }}
    />
  );
}

export function TrashGlyph({ color, size = 16 }: GlyphProps) {
  return (
    <View testID="glyph-trash" style={{ width: size, height: size, alignItems: 'center', gap: 1 }}>
      <View style={{ width: size * 0.3, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: size * 0.8, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: size * 0.56, flex: 1, borderWidth: 2, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
    </View>
  );
}

/** Kit FilterG3: three slider rails, each with a knob. */
export function FilterGlyph({ color, size = 18 }: GlyphProps) {
  const knobs = [0.68, 0.3, 0.55];
  return (
    <View testID="glyph-filter" style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: size * 0.1 }}>
      {knobs.map((x, i) => (
        <View key={i} style={{ height: 2, borderRadius: 1, backgroundColor: color, justifyContent: 'center' }}>
          <View
            style={{ position: 'absolute', left: size * x - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
          />
        </View>
      ))}
    </View>
  );
}
