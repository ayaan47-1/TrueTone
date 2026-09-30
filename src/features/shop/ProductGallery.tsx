// src/features/shop/ProductGallery.tsx
// The v3 product-page image pager (frame t-11): full-bleed slides with page dots. Slide 1 is
// the product's bundled photo, slide 2 the drawn art in the product's own shade colour.
// Local assets only; nothing is fetched.
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { palette } from '../../theme/tokens';
import type { Product } from '../match/match-types';
import { ProductArt } from './ProductArt';

const SLIDES = ['photo', 'shade'] as const;

export function ProductGallery({ product, height }: { product: Product; height: number }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const w = e.nativeEvent.layoutMeasurement.width || width;
    setPage(Math.max(0, Math.min(SLIDES.length - 1, Math.round(e.nativeEvent.contentOffset.x / w))));
  };
  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
        {SLIDES.map((s) => (
          <View key={s} testID="gallery-slide" style={{ width, height }}>
            <ProductArt product={product} height={height} radius={0} drawn={s === 'shade'} />
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" className="absolute bottom-[42px] left-0 right-0 flex-row justify-center gap-[5px]">
        {SLIDES.map((s, i) => (
          <View
            key={s}
            testID={`gallery-dot-${i}`}
            style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? palette.ink : 'rgba(34,31,26,0.2)' }}
          />
        ))}
      </View>
    </View>
  );
}
