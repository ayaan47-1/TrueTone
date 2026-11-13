import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GlassSurface } from '../../components/ui';
import { useInsets } from '../../components/ui/use-insets';
import { hasLiquidGlass } from '../../components/ui/liquid-glass';
import { glass, palette, softShadow } from '../../theme/tokens';
import { ChevronGlyph } from './shop-icons';

export function ProductDetailShell({children,hero,footer,actions,onClose}: {
  children:ReactNode; hero?:ReactNode; footer?:ReactNode; actions?:ReactNode; onClose:()=>void;
}) {
  const insets=useInsets();
  return <View testID="product-detail-shell" className="flex-1 bg-mist-50">
    <ScrollView contentContainerStyle={{paddingTop:hero?0:insets.top+72,paddingBottom:130+insets.bottom}}>
      {hero}{children}
    </ScrollView>
    {footer ? <View testID="product-detail-cta" className="absolute bottom-0 left-0 right-0 border-t border-ink-faint/20 bg-mist-50/95 px-5 pt-3" style={{paddingBottom:16+insets.bottom}}>
      {footer}
    </View> : null}
    {actions}
    <BackButton onPress={onClose} top={insets.top+8} />
  </View>;
}

/** Kit IconBtn: a 48px glass circle pinned over the art, outside the scroll so it never scrolls away. */
export function BackButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={4}
      style={[
        { position: 'absolute', top, left: 20, width: 48, height: 48, borderRadius: 24 },
        // Fallback fill lives on the shadow-bearing view so Android elevation still draws.
        hasLiquidGlass() ? null : { backgroundColor: glass.fillStrong },
        softShadow,
      ]}
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ borderWidth: 1, borderColor: glass.edge }}
      >
        <View style={{ marginLeft: 3 }}>
          <ChevronGlyph color={palette.ink} size={9} dir="left" />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

