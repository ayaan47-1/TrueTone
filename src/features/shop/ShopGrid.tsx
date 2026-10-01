// src/features/shop/ShopGrid.tsx
// Quiet Glass v3 Shop screen body (ShopV3 port, frames t-04/t-07/t-13): title + saved heart +
// bag button, search + filter button, a scan prompt (pre-scan only), category chips, product
// count + sort label, the one-time sample-catalog label, and a 2-column tile grid. The sort
// label and filter button open the Sort & filter sheet. Composition is the pure shelfItems();
// fit shows as a tier word only. "Top rated" (sample ratings) appears only behind the flag.
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Body, Caption, Display, GlassSurface, PressableScale, Subheading } from '../../components/ui';
import { CameraGlyph, ShopGlyph } from '../../components/ui/tab-icons';
import { glass, palette } from '../../theme/tokens';
import type { MatchProfile, Product } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import type { Filter } from '../../content/makeup-vocab';
import { bagCount, useBag } from '../checkout/bag-store';
import { FilterTabs } from './FilterTabs';
import { FilterSheet } from './FilterSheet';
import { SAMPLE_CATALOG_LABEL, SAMPLE_RATINGS_ENABLED } from './sample-content';
import { useWishlist } from './wishlist-store';
import { ProductTile } from './ProductTile';
import { KIT_PHOTOS, spreadPhotoKeys } from './product-photos';
import { shelfItems, SORT_LABELS, type FinishFilter, type ShelfItem, type ShelfSort } from './shelf';
import { ChevronGlyph, FilterGlyph, SearchGlyph } from './shop-icons';

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
  /** Sample ratings + "Top rated" sort; defaults to the SAMPLE_RATINGS_ENABLED flag. */
  showRatings?: boolean;
}

export function ShopGrid({
  profile,
  products = catalog,
  initialFilter = 'all',
  autoFocusSearch = false,
  onOpen,
  onScan,
  onBag,
  showRatings = SAMPLE_RATINGS_ENABLED,
}: ShopGridProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShelfSort>('match');
  const [finish, setFinish] = useState<FinishFilter>('any');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useWishlist();
  const shelf = shelfItems({ products, profile, filter, query, sort, finish });
  const items = savedOnly ? shelf.filter((i) => saved.includes(i.product.id)) : shelf;
  const sortLabel = SORT_LABELS[sort][profile ? 'scanned' : 'neutral'];

  return (
    <View>
      <View className="mt-1 flex-row items-center justify-between">
        <Display>{savedOnly ? 'Saved' : 'Shop'}</Display>
        <View className="flex-row gap-2.5">
          <SavedButton count={saved.length} on={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
          <BagButton onPress={onBag} />
        </View>
      </View>
      <View className="mt-4 flex-row items-center gap-2.5">
        <View style={{ flex: 1 }}>
          <SearchBar value={query} onChange={setQuery} autoFocus={autoFocusSearch} />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Sort and filter"
          onPress={() => setSheetOpen(true)}
          className="h-[50px] w-[50px] items-center justify-center rounded-full bg-sage"
        >
          <FilterGlyph color={palette.white} size={18} />
        </PressableScale>
      </View>
      {profile ? null : <ScanPrompt onPress={onScan} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 mt-[18px]" contentContainerStyle={{ paddingHorizontal: 24 }}>
        <FilterTabs value={filter} onChange={setFilter} />
      </ScrollView>
      <View className="mb-3 mt-[18px] flex-row items-center justify-between">
        <Caption>{items.length} {items.length === 1 ? 'product' : 'products'}</Caption>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
          onPress={() => setSheetOpen(true)}
          className="flex-row items-center gap-2"
        >
          <Text testID="sort-label" className="font-body-semibold text-[13px] text-ink">{sortLabel}</Text>
          <ChevronGlyph color={palette.ink} size={7} dir="down" />
        </PressableScale>
      </View>
      <Caption testID="sample-catalog-label" className="-mt-1 mb-3 text-[11px] text-ink-soft">{SAMPLE_CATALOG_LABEL}</Caption>
      {items.length ? <Grid items={items} showRatings={showRatings} onOpen={onOpen} /> : <NoResults />}
      <FilterSheet
        visible={sheetOpen}
        sort={sort}
        finish={finish}
        scanned={!!profile}
        showRatingSort={showRatings}
        onApply={(nextSort, nextFinish) => {
          setSort(nextSort);
          setFinish(nextFinish);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

interface GridProps {
  items: readonly ShelfItem[];
  showRatings: boolean;
  onOpen: (id: string) => void;
}

function Grid({ items, showRatings, onOpen }: GridProps) {
  const rows: ShelfItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  const keys = spreadPhotoKeys(items.map((i) => i.product));
  const photoFor = new Map(items.map((i, n) => [i.product.id, KIT_PHOTOS[keys[n]]]));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.map((r) => r.product.id).join('|')} className="flex-row gap-3">
          {row.map((i) => (
            <ProductTile
              key={i.product.id}
              product={i.product}
              tier={i.tier}
              isBestMatch={i.isBestMatch}
              showRatings={showRatings}
              onOpen={onOpen}
              photo={photoFor.get(i.product.id)}
            />
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
    <HeaderIconButton
      label={count ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag'}
      badge={count}
      onPress={onPress}
    >
      <ShopGlyph color={palette.ink} size={20} />
    </HeaderIconButton>
  );
}

/** Kit header heart: toggles the grid to saved items only. */
function SavedButton({ count, on, onPress }: { count: number; on: boolean; onPress: () => void }) {
  return (
    <HeaderIconButton
      label={count ? `Saved items, ${count}` : 'Saved items'}
      badge={count}
      selected={on}
      onPress={onPress}
    >
      <Text style={{ fontSize: 18, lineHeight: 22, color: palette.ink }}>{on ? '♥' : '♡'}</Text>
    </HeaderIconButton>
  );
}

interface HeaderIconButtonProps {
  label: string;
  badge: number;
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
}

function HeaderIconButton({ label, badge, selected, onPress, children }: HeaderIconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      className="h-11 w-11 rounded-full"
    >
      <GlassSurface
        interactive
        intensity={0}
        style={{ flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        fallbackStyle={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
      >
        {children}
      </GlassSurface>
      {badge ? (
        <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1">
          <Text className="font-body-bold text-[10px] text-white">{badge}</Text>
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
      className="h-[50px] flex-row items-center gap-2.5 rounded-[16px] px-4"
      style={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
    >
      <SearchGlyph color={palette.inkSoft} size={17} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search products, shades, brands"
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
