// src/features/foryou/HomeV3Parts.tsx
// Quiet Glass v3 For You home pieces (HomeV3 port): a search entry, a static hero card,
// quick actions and category shortcuts. Deliberately changed from the kit (Pam's review):
// the rotating 3-slide hero is ONE static card with no photo, no "15% off / TRUE15" promo
// and no motion beyond the press scale (F3); the unshipped "Seasonal · NEW" action is gone
// and "Shade twins" is plain "Community" (F5); no "20 seconds" timing claim.
import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { PressableScale } from '../../components/ui';
import { CameraGlyph, CommunityGlyph, RoutineGlyph } from '../../components/ui/tab-icons';
import { glass, palette, softShadow } from '../../theme/tokens';
import { catalog } from '../match/product-catalog';
import { FILTER_LABELS, type Filter } from '../../content/makeup-vocab';
import { ProductArt } from '../shop/ProductArt';
import { SearchGlyph } from '../shop/shop-icons';

type Go = (path: string) => void;
type Glyph = ComponentType<{ color: string; size?: number }>;

const cardSurface = { backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge };

export function HomeSearch({ onOpen }: { onOpen: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Search products"
      onPress={onOpen}
      className="h-12 flex-row items-center gap-2.5 rounded-full px-4"
      style={cardSurface}
    >
      <SearchGlyph color={palette.inkSoft} size={17} />
      <Text className="font-body text-[15px] text-ink-faint">Search products</Text>
    </PressableScale>
  );
}

interface HeroCardProps {
  /** The derived shade word (post-scan only). */
  shadeName?: string;
  onScan: () => void;
  onShop: () => void;
}

export function HeroCard({ shadeName, onScan, onShop }: HeroCardProps) {
  const cta = shadeName ? 'See my matches' : 'Start scan';
  return (
    <View className="overflow-hidden rounded-[28px] bg-ink p-[22px]" style={softShadow}>
      <Text className="font-body-semibold text-[10.5px] uppercase tracking-[1.6px] text-white/60">
        {shadeName ? 'Your shade' : 'Shade match'}
      </Text>
      <Text className="mt-2 max-w-[230px] font-display text-[23px] leading-[28px] tracking-[-0.5px] text-white">
        {shadeName ? `${shadeName} is your match` : 'Find your true shade'}
      </Text>
      <Text className="mt-1.5 max-w-[230px] font-body text-[13px] leading-[19px] text-white/70">
        {shadeName ? 'Picks ranked for your tone.' : 'One selfie, read on your phone.'}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={cta}
        onPress={shadeName ? onShop : onScan}
        className="mt-3.5 self-start rounded-full bg-white px-[18px] py-2.5"
      >
        <Text className="font-body-semibold text-[13px] text-ink">{cta}</Text>
      </PressableScale>
    </View>
  );
}

const ACTIONS: readonly (readonly [string, Glyph, string])[] = [
  ['Shade match', CameraGlyph, '/scan-gate'],
  ['Routine', RoutineGlyph, '/routine'],
  ['Community', CommunityGlyph, '/community'],
];

export function QuickActions({ onGo }: { onGo: Go }) {
  return (
    <View className="flex-row gap-2.5">
      {ACTIONS.map(([label, Icon, path]) => (
        <PressableScale
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => onGo(path)}
          className="flex-1 items-center gap-2 rounded-[20px] px-1 pb-3 pt-3.5"
          style={[cardSurface, softShadow]}
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
            <Icon color={palette.sageInk} size={20} />
          </View>
          <Text className="font-body-semibold text-[11.5px] text-ink">{label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const CATEGORY_ORDER: readonly Filter[] = ['face', 'eyes', 'lips', 'all'];

export function Categories({ onGo }: { onGo: Go }) {
  return (
    <View className="flex-row justify-between">
      {CATEGORY_ORDER.map((k) => {
        const rep = k === 'all' ? undefined : catalog.find((p) => p.category === k);
        return (
          <PressableScale
            key={k}
            accessibilityRole="button"
            accessibilityLabel={FILTER_LABELS[k]}
            onPress={() => onGo(`/shop?cat=${k}`)}
            className="w-[60px] items-center gap-2"
          >
            {rep ? (
              <View style={{ width: 58 }}>
                <ProductArt product={rep} height={58} radius={29} />
              </View>
            ) : (
              <AllTile />
            )}
            <Text className="font-body-medium text-[12px] text-ink-soft">{FILTER_LABELS[k]}</Text>
          </PressableScale>
        );
      })}
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
