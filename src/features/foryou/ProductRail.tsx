// src/features/foryou/ProductRail.tsx
// A horizontal rail of product cards for the For You screen. Reuses ProductCard as-is
// (the exact {product, profile, isBestMatch} shape Shop already uses) inside a
// fixed-width wrapper, rather than a parallel card implementation -- same theme tokens,
// same Add-to-bag wiring, one visual language across Shop and For You.
import { ScrollView, View } from 'react-native';
import type { MatchProfile, Product } from '../match/match-types';
import { ProductCard } from '../shop/ProductCard';
import { SectionHead } from './HomeV3Parts';

interface ProductRailProps {
  title: string;
  /** Omit for a lighter, title-only header (e.g. the Featured rail). */
  subtitle?: string;
  products: readonly Product[];
  /**
   * When present, cards show a fit tier and the FIRST card (already best-first out of
   * for-you-profile.ts's ranking) carries the Best-match badge -- the same semantics
   * ShopGrid uses. Omit for a neutral, no-fit browsing rail (e.g. Featured).
   */
  profile?: MatchProfile;
  /** Adds a "See all ›" action beside the title (video t-02). */
  onSeeAll?: () => void;
}

const railTestId = (title: string): string =>
  `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

/** A titled horizontal rail of ProductCards. Renders nothing for an empty product list. */
export function ProductRail({ title, subtitle, products, profile, onSeeAll }: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <View testID={railTestId(title)}>
      <SectionHead title={title} sub={subtitle} onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-1"
        contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 8 }}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        {products.map((product, index) => (
          <View key={product.id} className="mr-3 w-[168px]">
            <ProductCard
              product={product}
              profile={profile}
              isBestMatch={Boolean(profile) && index === 0}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
