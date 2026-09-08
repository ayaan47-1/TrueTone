// src/features/shop/ShopList.tsx
// The Shop shelf. POST-scan it ranks the catalog best-first for the person AND the
// active filter (top card badged "Best match"), via the match boundary's rankedForFilter.
// PRE-scan (no profile) it shows the catalog in its neutral order with no fit signal.
import { useState } from 'react';
import { View } from 'react-native';
import { Eyebrow, Heading, Body } from '../../components/ui';
import type { Product, MatchProfile } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import { rankedForFilter } from '../match/sort';
import { type Filter } from '../../content/makeup-vocab';
import { FilterTabs } from './FilterTabs';
import { ProductCard } from './ProductCard';

interface ShopListProps {
  /** Present ONLY after a scan — drives ranking + fit pills. Absent = neutral shelf. */
  profile?: MatchProfile;
  /** Overridable for tests; defaults to the seed catalog. */
  products?: readonly Product[];
}

/** Filter the neutral (pre-scan) shelf the same way the ranked path does. */
function neutralItems(products: readonly Product[], filter: Filter): Product[] {
  if (filter === 'all') return products.filter((p) => p.category !== 'prep');
  return products.filter((p) => p.category === filter);
}

/** The Shop list: filter tabs over compatibility-ranked (or neutral) product cards. */
export function ShopList({ profile, products = catalog }: ShopListProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const cards = profile
    ? rankedForFilter(products, profile, filter).map((s) => ({
        product: s.product,
        isBestMatch: s.isBestMatch,
      }))
    : neutralItems(products, filter).map((product) => ({ product, isBestMatch: false }));

  return (
    <View className="gap-5">
      <View className="gap-2">
        <Eyebrow>Shop</Eyebrow>
        <Heading>{profile ? 'Matched to your shade' : 'Find your shade'}</Heading>
        <Body className="text-ink-soft">
          {profile
            ? 'Ranked by how each one fits the shade and finish you like.'
            : 'Scan to see how each shade fits you — browse the range for now.'}
        </Body>
      </View>

      <FilterTabs value={filter} onChange={setFilter} />

      <View className="gap-3">
        {cards.map(({ product, isBestMatch }) => (
          <ProductCard
            key={product.id}
            product={product}
            profile={profile}
            isBestMatch={isBestMatch}
          />
        ))}
      </View>
    </View>
  );
}
