// src/features/shop/ProductArt.tsx
// The Quiet Glass v3 product visual (port of the design kit's ProductArt3 fallback): the
// product drawn as a simple container shape in its own swatch colour over a pale wash.
// Offline, no remote images. When a bundled LOCAL photo is registered for
// the product (product-photos.ts) it is shown instead, full-bleed.
import type { ReactNode } from 'react';
import { Image, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import type { Product } from '../match/match-types';
import { productPhoto, productShape, productTone, type ProductShape } from './product-visual';

const CAP = '#3F3A33';
const GOLD = '#C9A77C';
const CREAM = '#EFE7DD';

interface ProductArtProps {
  product: Product;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Override the registry lookup (tests, previews). */
  photo?: ImageSourcePropType;
  /** Overlays (save button, best-match badge). */
  children?: ReactNode;
}

interface Part {
  w: number;
  h: number;
  color: string;
  radius: number;
  gloss?: boolean;
}

/** Stacked parts (top → bottom) per shape, in units of height/100 — mirrors the kit. */
function partsFor(shape: ProductShape, c: string): Part[] {
  switch (shape) {
    case 'dropper':
      return [
        { w: 9, h: 14, color: CAP, radius: 4 },
        { w: 15, h: 6, color: GOLD, radius: 2 },
        { w: 34, h: 42, color: c, radius: 9, gloss: true },
      ];
    case 'pump':
      return [
        { w: 18, h: 5, color: CAP, radius: 2 },
        { w: 5, h: 7, color: CAP, radius: 0 },
        { w: 28, h: 50, color: c, radius: 7, gloss: true },
      ];
    case 'tube':
      return [
        { w: 20, h: 12, color: CAP, radius: 3 },
        { w: 22, h: 50, color: c, radius: 5, gloss: true },
      ];
    case 'jar':
      return [
        { w: 44, h: 12, color: CAP, radius: 4 },
        { w: 48, h: 28, color: c, radius: 10, gloss: true },
      ];
    case 'stick':
      return [
        { w: 13, h: 16, color: c, radius: 7 },
        { w: 17, h: 9, color: GOLD, radius: 2 },
        { w: 19, h: 32, color: CAP, radius: 3 },
      ];
    case 'compact':
      return [{ w: 52, h: 52, color: CREAM, radius: 26 }];
  }
}

function Drawing({ shape, color, k }: { shape: ProductShape; color: string; k: number }) {
  return (
    <View testID={`product-art-${shape}`} className="items-center">
      {partsFor(shape, color).map((p, i) => (
        <View
          key={i}
          style={{
            width: p.w * k,
            height: p.h * k,
            borderRadius: p.radius * k,
            backgroundColor: p.color,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {p.gloss ? (
            <View
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', backgroundColor: 'rgba(255,255,255,0.3)' }}
            />
          ) : null}
          {shape === 'compact' ? (
            <View style={{ width: 34 * k, height: 34 * k, borderRadius: 17 * k, backgroundColor: color }} />
          ) : null}
        </View>
      ))}
      <View
        style={{ width: 46 * k, height: 4 * k, borderRadius: 2 * k, marginTop: 2 * k, backgroundColor: 'rgba(34,31,26,0.08)' }}
      />
    </View>
  );
}

/** Product visual: registered licensed photo if any, else the drawn shape. */
export function ProductArt({ product, height, radius = 18, style, photo, children }: ProductArtProps) {
  const source = photo ?? productPhoto(product.id);
  const tone = productTone(product);
  return (
    <View
      style={[
        { height, borderRadius: radius, backgroundColor: tone.backdrop, overflow: 'hidden' },
        style,
      ]}
    >
      {/* The art is one labelled image; overlays (save, badge) stay separately focusable. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={product.name}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {source !== undefined ? (
          <Image
            testID="product-photo"
            source={source}
            resizeMode="cover"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : (
          <Drawing shape={productShape(product)} color={tone.product} k={height / 100} />
        )}
      </View>
      {children}
    </View>
  );
}
