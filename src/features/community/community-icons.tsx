// src/features/community/community-icons.tsx
// Small, local engagement glyphs for the Community module. Plain View-based shapes,
// matching the app's existing icon convention (src/components/ui/tab-icons.tsx) --
// no icon library, no image assets. Kept local to this feature rather than added to
// the shared tab-icons file, which is Commerce-owned tab-bar territory.
import { Text, View } from 'react-native';

export interface CommunityGlyphProps {
  color: string;
  size?: number;
  /** Filled = liked/saved. Outline otherwise. */
  filled?: boolean;
}

// The like control is a heart, and only a heart. Unicode hearts with the text
// variation selector (U+FE0E) so iOS draws a tintable glyph, not a coloured emoji.
const HEART_OUTLINE = '\u2661\uFE0E';
const HEART_FILLED = '\u2665\uFE0E';

export function HeartGlyph({ color, size = 20, filled = false }: CommunityGlyphProps) {
  return (
    <Text
      testID="heart-glyph"
      accessible={false}
      allowFontScaling={false}
      style={{ color, fontSize: size, lineHeight: size * 1.15, width: size, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' }}
    >
      {filled ? HEART_FILLED : HEART_OUTLINE}
    </Text>
  );
}

export function BookmarkGlyph({ color, size = 20, filled = false }: CommunityGlyphProps) {
  return (
    <View
      style={{
        width: size * 0.7,
        height: size,
        borderWidth: filled ? 0 : 2,
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        borderBottomWidth: 0,
      }}
    />
  );
}

export function ShareGlyph({ color, size = 20 }: CommunityGlyphProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
      <View style={{ width: size * 0.55, height: 2, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: size * 0.32,
          height: size * 0.32,
          borderTopWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
        }}
      />
    </View>
  );
}
