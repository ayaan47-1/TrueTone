// src/features/shop/ProductTile.tsx
// Quiet Glass v3 product card (ProductCard3 port) for the Shop grid and home rails: drawn
// product art, line eyebrow, title, qualitative fit tier (post-scan only), price and a
// round add button. Deliberately left out of the kit's card: star ratings + review counts
// (no real review data — FTC fake-review risk) and the numeric "% fit" (tiers only).
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Caption, PressableScale } from '../../components/ui';
import { glass, palette, softShadow } from '../../theme/tokens';
import type { Product } from '../match/match-types';
import { BEST_MATCH_BADGE, FIT_TIER_LABELS, type FitTier } from '../../content/makeup-vocab';
import { bag } from '../checkout/bag-store';
import { ProductArt } from './ProductArt';
import { productLine } from './product-visual';
import { CheckGlyph, PlusGlyph } from './shop-icons';

/** How long the added confirmation holds before the button reverts. */
const ADDED_HOLD_MS = 1400;

interface ProductTileProps {
  product: Product;
  /** Post-scan only. Absent = neutral card. */
  tier?: FitTier;
  isBestMatch?: boolean;
  artHeight?: number;
  onOpen: (id: string) => void;
}

export function ProductTile({ product, tier, isBestMatch = false, artHeight = 136, onOpen }: ProductTileProps) {
  const { line, title } = productLine(product);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const add = (): void => {
    bag.add(product);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_HOLD_MS);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${product.name}`}
      onPress={() => onOpen(product.id)}
      testID={`product-${product.id}`}
      style={{ flex: 1 }}
    >
      <View
        style={[
          { flex: 1, borderRadius: 22, padding: 7, backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge },
          softShadow,
        ]}
      >
        <ProductArt product={product} height={artHeight} radius={16}>
          {isBestMatch && tier ? (
            <View testID="best-match-badge" className="absolute left-2.5 top-2.5 rounded-full bg-sage px-2.5 py-0.5">
              <Text className="font-body-semibold text-[10.5px] text-white">{BEST_MATCH_BADGE}</Text>
            </View>
          ) : null}
        </ProductArt>
        <View className="flex-1 gap-1 px-1.5 pb-1 pt-2.5">
          {line ? (
            <Text className="font-body-semibold text-[10.5px] uppercase tracking-[1px] text-sage">{line}</Text>
          ) : null}
          <Text numberOfLines={2} className="min-h-[38px] font-display-md text-[14px] leading-[19px] text-ink">
            {title}
          </Text>
          {tier ? (
            <Caption testID="fit-tier" className="font-body-bold text-[11px] text-brand-greenDark">
              {FIT_TIER_LABELS[tier]}
            </Caption>
          ) : null}
          <View className="mt-auto flex-row items-center justify-between pt-1.5">
            <Text className="font-body-bold text-[16px] text-ink">${product.price}</Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to bag`}
              onPress={add}
              hitSlop={8}
              testID={`add-to-bag-${product.id}`}
            >
              <View
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: added ? palette.sage : palette.ink }}
              >
                {added ? <CheckGlyph color={palette.white} size={11} /> : <PlusGlyph color={palette.white} size={11} />}
              </View>
            </PressableScale>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
