// src/features/shop/ShopGrid.tsx
// Quiet Glass v3 Shop screen body (ShopV3 port): title + bag button, search, a scan prompt
// (pre-scan only), category chips, product count + sort toggle, and a 2-column tile grid.
// Composition is the pure shelfItems(); fit shows as a tier word only. Left out of the kit
// on purpose: the "Saved" heart (no wishlist yet), the "Top rated" sort (no review data),
// and the filter sheet (the sort toggle covers the two sorts we can honestly offer).
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Body, Caption, Display, GlassSurface, PressableScale, Subheading } from '../../components/ui';
import { CameraGlyph, ShopGlyph } from '../../components/ui/tab-icons';
import { glass, palette } from '../../theme/tokens';
import type { MatchProfile, Product } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import type { Filter } from '../../content/makeup-vocab';
import { bagCount, useBag } from '../checkout/bag-store';
import { FilterTabs } from './FilterTabs';
import { ProductTile } from './ProductTile';
import { shelfItems, SORT_LABELS, type ShelfItem, type ShelfSort } from './shelf';
import { ChevronGlyph, SearchGlyph } from './shop-icons';

interface ShopGridProps {
  /** Present only after a scan. */
  profile?: MatchProfile;
  products?: readonly Product[];
  /** Category to open on (home shortcuts). */
  initialFilter?: Filter;
  /** Open with the search field focused (the home search bar routes here). */
  autoFocusSearch?: boolean;
  onOpen: (id: string) => void;
  onScan: () => void;
  onBag: () => void;
}

export function ShopGrid({
  profile,
  products = catalog,
  initialFilter = 'all',
  autoFocusSearch = false,
  onOpen,
  onScan,
  onBag,
}: ShopGridProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShelfSort>('match');
  const items = shelfItems({ products, profile, filter, query, sort });
  const sortLabel = SORT_LABELS[sort][profile ? 'scanned' : 'neutral'];

  return (
    <View>
      <View className="mt-1 flex-row items-center justify-between">
        <Display>Shop</Display>
        <BagButton onPress={onBag} />
      </View>
      <SearchBar value={query} onChange={setQuery} autoFocus={autoFocusSearch} />
      {profile ? null : <ScanPrompt onPress={onScan} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 mt-[18px]" contentContainerStyle={{ paddingHorizontal: 24 }}>
        <FilterTabs value={filter} onChange={setFilter} />
      </ScrollView>
      <View className="mb-3 mt-[18px] flex-row items-center justify-between">
        <Caption>{items.length} products</Caption>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
          onPress={() => setSort(sort === 'match' ? 'price' : 'match')}
          className="flex-row items-center gap-2"
        >
          <Text testID="sort-label" className="font-body-semibold text-[13px] text-ink">{sortLabel}</Text>
          <ChevronGlyph color={palette.ink} size={7} dir="down" />
        </PressableScale>
      </View>
      {items.length ? <Grid items={items} onOpen={onOpen} /> : <NoResults />}
    </View>
  );
}

function Grid({ items, onOpen }: { items: readonly ShelfItem[]; onOpen: (id: string) => void }) {
  const rows: ShelfItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.map((r) => r.product.id).join('|')} className="flex-row gap-3">
          {row.map((i) => (
            <ProductTile key={i.product.id} product={i.product} tier={i.tier} isBestMatch={i.isBestMatch} onOpen={onOpen} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function NoResults() {
  return (
    <View className="items-center py-10">
      <Subheading>No results</Subheading>
      <Body className="mt-1">Try another search or category.</Body>
    </View>
  );
}

export function BagButton({ onPress }: { onPress: () => void }) {
  const count = bagCount(useBag());
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag'}
      onPress={onPress}
      className="h-11 w-11 rounded-full"
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
      >
        <ShopGlyph color={palette.ink} size={20} />
      </GlassSurface>
      {count ? (
        <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sage px-1">
          <Text className="font-body-bold text-[10px] text-white">{count}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, autoFocus = false }: SearchBarProps) {
  return (
    <View
      className="mt-4 h-12 flex-row items-center gap-2.5 rounded-full px-4"
      style={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
    >
      <SearchGlyph color={palette.inkSoft} size={17} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search products"
        placeholderTextColor={palette.inkFaint}
        accessibilityLabel="Search products"
        className="flex-1 font-body text-[15px] text-ink"
        returnKeyType="search"
        autoFocus={autoFocus}
      />
    </View>
  );
}

function ScanPrompt({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="See your fit on every product"
      onPress={onPress}
      className="mt-3.5 flex-row items-center gap-3 rounded-[18px] bg-brand-tint px-3.5 py-3"
    >
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-sage">
        <CameraGlyph color={palette.white} size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-body-semibold text-[13.5px] text-brand-greenDark">See your fit on every product</Text>
        <Text className="font-body text-[12px] text-brand-greenDark">Take a quick shade scan</Text>
      </View>
      <ChevronGlyph color={palette.sageInk} />
    </PressableScale>
  );
}
