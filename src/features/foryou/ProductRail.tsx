// src/features/foryou/ProductRail.tsx
// A horizontal rail of product cards for the For You screen. Reuses ProductCard as-is
// (the exact {product, profile, isBestMatch} shape Shop already uses) inside a
// fixed-width wrapper, rather than a parallel card implementation -- same theme tokens,
// same Add-to-bag wiring, one visual language across Shop and For You.
import { ScrollView, View } from 'react-native';
import { Subheading, Caption } from '../../components/ui';
import type { MatchProfile, Product } from '../match/match-types';
import { ProductCard } from '../shop/ProductCard';

interface ProductRailProps {
  title: string;
  /** Omit for a lighter, title-only header (e.g. the Featured rail). */
  subtitle?: string;
  products: readonly Product[];
  /**
   * When present, cards show a fit % and the FIRST card (already best-first out of
   * for-you-profile.ts's ranking) carries the Best-match badge -- the same semantics
   * ShopList uses. Omit for a neutral, no-fit browsing rail (e.g. Featured).
   */
  profile?: MatchProfile;
}

const railTestId = (title: string): string =>
  `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

/** A titled horizontal rail of ProductCards. Renders nothing for an empty product list. */
export function ProductRail({ title, subtitle, products, profile }: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <View className="gap-3" testID={railTestId(title)}>
      <View className="gap-0.5">
        <Subheading accessibilityRole="header">{title}</Subheading>
        {subtitle ? <Caption className="text-ink-soft">{subtitle}</Caption> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-1"
        contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 8 }}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        {products.map((product, index) => (
          <View key={product.id} className="w-52 mr-3">
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
