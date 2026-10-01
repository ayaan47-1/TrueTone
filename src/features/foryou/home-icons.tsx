// src/features/foryou/home-icons.tsx
// Home-only glyphs drawn with Views (the app ships no icon font), in the same style as
// components/ui/tab-icons.tsx: a bell for notifications and sliders for sort & filter.
import { View } from 'react-native';
import type { GlyphProps } from '../../components/ui/tab-icons';

/** Notifications — a bell body over a small clapper. */
export function BellGlyph({ color, size = 19 }: GlyphProps) {
  const w = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w,
          height: size * 0.6,
          borderWidth: 2,
          borderColor: color,
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          borderBottomWidth: 0,
        }}
      />
      <View style={{ width: size * 0.84, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ marginTop: 2, width: size * 0.22, height: size * 0.12, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/** Sort & filter — three slider rails with offset knobs. */
export function FilterGlyph({ color, size = 20 }: GlyphProps) {
  const knob = size * 0.3;
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: size * 0.08 }}>
      {[0.2, 0.6, 0.35].map((at, i) => (
        <View key={i} style={{ height: knob, justifyContent: 'center' }}>
          <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />
          <View
            style={{
              position: 'absolute',
              left: size * at,
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              borderWidth: 2,
              borderColor: color,
              backgroundColor: 'transparent',
            }}
          />
        </View>
      ))}
    </View>
  );
}
