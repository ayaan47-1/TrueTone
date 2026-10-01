// src/features/foryou/HomeV3Parts.tsx
// Quiet Glass v3 For You home pieces, matched to the designer's walkthrough video
// (t-01..t-03): a search row with a sort-and-filter button, four quick actions (Seasonal
// badged NEW), photo category shortcuts and a section header with "See all".
// Deliberately kept from compliance: no "20 seconds" timing claim, no numeric fit.
import type { ComponentType } from 'react';
import { Image, Text, View } from 'react-native';
import { PressableScale } from '../../components/ui';
import { CameraGlyph, CommunityGlyph, RoutineGlyph, TrendGlyph } from '../../components/ui/tab-icons';
import { glass, palette, softShadow } from '../../theme/tokens';
import { SearchGlyph, ChevronGlyph } from '../shop/shop-icons';
import { FilterGlyph } from './home-icons';
import { CATEGORY_PHOTOS } from './home-photos';

type Go = (path: string) => void;
type Glyph = ComponentType<{ color: string; size?: number }>;

const cardSurface = { backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge };

interface HomeSearchProps {
  onOpen: () => void;
  onFilter: () => void;
}

export function HomeSearch({ onOpen, onFilter }: HomeSearchProps) {
  return (
    <View className="flex-row items-center gap-2.5">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Search products"
        onPress={onOpen}
        className="h-[52px] flex-1 flex-row items-center gap-2.5 rounded-[18px] px-4"
        style={cardSurface}
      >
        <SearchGlyph color={palette.inkSoft} size={17} />
        <Text numberOfLines={1} className="flex-1 font-body text-[15px] text-ink-faint">
          Search products, shades, brands
        </Text>
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Sort and filter"
        onPress={onFilter}
        className="h-[52px] w-[52px] items-center justify-center rounded-full bg-sage"
        style={softShadow}
      >
        <FilterGlyph color={palette.white} size={20} />
      </PressableScale>
    </View>
  );
}

interface QuickAction {
  readonly label: string;
  readonly Icon: Glyph;
  readonly path?: string;
  readonly isNew?: boolean;
}

const ACTIONS: readonly QuickAction[] = [
  { label: 'Shade match', Icon: CameraGlyph, path: '/scan-gate' },
  { label: 'Routine', Icon: RoutineGlyph, path: '/routine' },
  { label: 'Shade twins', Icon: CommunityGlyph, path: '/community' },
  { label: 'Seasonal', Icon: TrendGlyph, isNew: true },
];

interface QuickActionsProps {
  onGo: Go;
  /** Seasonal has no route: it opens the home's seasonal sheet. */
  onSeasonal: () => void;
}

export function QuickActions({ onGo, onSeasonal }: QuickActionsProps) {
  return (
    <View className="flex-row gap-2.5">
      {ACTIONS.map(({ label, Icon, path, isNew }) => (
        <PressableScale
          key={label}
          accessibilityRole="button"
          accessibilityLabel={isNew ? `${label}, new` : label}
          onPress={() => (path ? onGo(path) : onSeasonal())}
          className="flex-1 items-center gap-2 rounded-[20px] px-1 pb-3 pt-3.5"
          style={[cardSurface, softShadow]}
        >
          {isNew ? (
            <View className="absolute right-1.5 top-1.5 rounded-full bg-rose-200 px-[5px] py-[2px]">
              <Text className="font-body-bold text-[8.5px] tracking-[0.6px]" style={{ color: palette.clayInk }}>NEW</Text>
            </View>
          ) : null}
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
            <Icon color={palette.sageInk} size={20} />
          </View>
          <View className="min-h-[28px] justify-center">
            <Text className="text-center font-body-semibold text-[11.5px] leading-[14px] text-ink">{label}</Text>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

type CategoryKey = keyof typeof CATEGORY_PHOTOS;

const CATEGORIES: readonly (readonly [CategoryKey | 'all', string])[] = [
  ['face', 'Face'],
  ['eyes', 'Eyes'],
  ['lips', 'Lips'],
  ['cheeks', 'Cheeks'],
  ['all', 'All'],
];

export function Categories({ onGo }: { onGo: Go }) {
  return (
    <View className="flex-row justify-between">
      {CATEGORIES.map(([k, label]) => (
        <PressableScale
          key={k}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => onGo(`/shop?cat=${k}`)}
          className="w-[60px] items-center gap-2"
        >
          {k === 'all' ? (
            <AllTile />
          ) : (
            <Image
              testID={`category-photo-${k}`}
              source={CATEGORY_PHOTOS[k]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: palette.mist300 }}
            />
          )}
          <Text className="font-body-medium text-[12px] text-ink-soft">{label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

function AllTile() {
  return (
    <View className="h-[58px] w-[58px] flex-row flex-wrap content-center justify-center gap-1 rounded-full bg-mist-300 px-[18px]">
      {[0, 1, 2, 3].map((n) => (
        <View key={n} style={{ width: 9, height: 9, borderRadius: 3, borderWidth: 2, borderColor: palette.mauve600 }} />
      ))}
    </View>
  );
}

interface SectionHeadProps {
  title: string;
  sub?: string;
  onAction?: () => void;
}

/** The one home section-title style (display face, 20px) — SectionHead and card titles share it. */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="font-display text-[20px] tracking-[-0.3px] text-ink">
      {children}
    </Text>
  );
}

/** A home section title (display face) with an optional subtitle and "See all ›". */
export function SectionHead({ title, sub, onAction }: SectionHeadProps) {
  return (
    <View className="mb-3.5 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <SectionTitle>{title}</SectionTitle>
        {sub ? <Text className="mt-0.5 font-body text-[13px] text-ink-muted">{sub}</Text> : null}
      </View>
      {onAction ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`See all ${title}`}
          onPress={onAction}
          className="flex-row items-center gap-1.5 pb-0.5"
        >
          <Text className="font-body-semibold text-[14px] text-sage">See all</Text>
          <ChevronGlyph color={palette.sage} size={8} />
        </PressableScale>
      ) : null}
    </View>
  );
}
