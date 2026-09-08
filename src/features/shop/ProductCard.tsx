// src/features/shop/ProductCard.tsx
// A single Shop product card. POST-scan (a MatchProfile is present) it shows a
// compatibility fit % pill + bar + a short cosmetic-only "why it fits" line, all
// sourced from the match boundary (scoring + fit-reason). PRE-scan (no profile) it
// stays NEUTRAL — "Shades available", never a fit % (plan Flag 3, hasScanned gating).
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GlassCard, Heading, Body, Caption, PressableScale } from '../../components/ui';
import type { Product, MatchProfile } from '../match/match-types';
import { scoreProduct } from '../match/scoring';
import { fitReason } from '../match/fit-reason';
import { BEST_MATCH_BADGE } from '../../content/makeup-vocab';
import { bag } from '../checkout/bag-store';

/** How long the "Added" affordance holds before the button reverts. */
const ADDED_HOLD_MS = 1200;

interface ProductCardProps {
  product: Product;
  /** Present ONLY after a scan. Its absence keeps the card neutral (no fit %). */
  profile?: MatchProfile;
  /** True for the single top-ranked card in the current filter view (post-scan only). */
  isBestMatch?: boolean;
}

/** Product card — fit-ranked when scanned, neutral shade-availability copy before. */
export function ProductCard({ product, profile, isBestMatch = false }: ProductCardProps) {
  const fit = profile ? scoreProduct(product, profile) : null;
  const reason = profile ? fitReason(product, profile) : null;
  const [justAdded, setJustAdded] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const addToBag = (): void => {
    bag.add(product);
    setJustAdded(true);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setJustAdded(false), ADDED_HOLD_MS);
  };

  return (
    <GlassCard testID={`product-${product.id}`} className="gap-2 p-4" flat>
      {isBestMatch && fit !== null ? (
        <View className="self-start rounded-full bg-brand-green px-3 py-1" testID="best-match-badge">
          <Caption className="text-white">{BEST_MATCH_BADGE}</Caption>
        </View>
      ) : null}

      <View className="flex-row items-start justify-between gap-3">
        <Heading testID="product-name" className="flex-1">
          {product.name}
        </Heading>
        <Body className="text-ink-soft">${product.price}</Body>
      </View>

      {fit !== null ? (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <View className="self-start rounded-full border border-brand-green px-2.5 py-1" testID="fit-pill">
              <Caption className="text-brand-green">{fit}% fit</Caption>
            </View>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-ink-faint/30" testID="fit-bar">
            <View className="h-full rounded-full bg-brand-green" style={{ width: `${fit}%` }} />
          </View>
          <Caption className="text-ink-soft">{reason}</Caption>
        </View>
      ) : (
        <Caption className="text-ink-faint">Shades available</Caption>
      )}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name} to bag`}
        onPress={addToBag}
        testID={`add-to-bag-${product.id}`}
        hitSlop={8}
        className="self-end"
      >
        <View className="rounded-full bg-brand-green px-4 py-2">
          <Caption className="text-white">{justAdded ? 'Added' : 'Add to bag'}</Caption>
        </View>
      </PressableScale>
    </GlassCard>
  );
}
