// src/features/checkout/BagScreen.tsx
// Quiet Glass v3 bag (BagV3 port): one glass card per product + shade line with a qty
// stepper and remove, a "Finish your look" add-on list, a total card and a pinned
// "Checkout · $X" CTA. The displayed total uses the same catalog-only item pricing as checkout.
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Body, Caption, GlassCard, Heading, MistBackground, PressableScale, PrimaryButton, Eyebrow } from '../../components/ui';
import { ShopGlyph } from '../../components/ui/tab-icons';
import { useInsets } from '../../components/ui/use-insets';
import { palette } from '../../theme/tokens';
import type { Product } from '../match/match-types';
import { catalog } from '../match/product-catalog';
import { ProductArt } from '../shop/ProductArt';
import { productLine } from '../shop/product-visual';
import { SAMPLE_CATALOG_LABEL } from '../shop/sample-content';
import { shadeOptions } from '../shop/shade-options';
import { Stepper } from '../shop/Stepper';
import { TrashGlyph } from '../shop/shop-icons';
import { bag, bagCount, lineKey, useBag, type BagLine } from './bag-store';
import { computeOrderTotalCents, formatCents } from './pricing';

const SUGGESTION_COUNT = 2;

interface BagScreenProps {
  onBack: () => void;
  onShop: () => void;
  onCheckout: () => void;
}

export function BagScreen({ onBack, onShop, onCheckout }: BagScreenProps) {
  const state = useBag();
  const insets = useInsets();
  const count = bagCount(state);

  if (!count) {
    return (
      <MistBackground>
        <View style={{ paddingTop: insets.top }}>
          <AppHeader title="My bag" onBack={onBack} />
        </View>
        <View className="items-center px-8 pt-20">
          <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-mist-300">
            <ShopGlyph color={palette.mauve600} size={34} />
          </View>
          <Heading className="mt-5 text-center">Your bag is empty</Heading>
          <Body className="mt-1.5 text-center">Products you add will show up here.</Body>
          <View className="mt-6">
            <PrimaryButton label="Start shopping" onPress={onShop} />
          </View>
        </View>
      </MistBackground>
    );
  }

  const inBag = new Set(state.lines.map((l) => l.product.id));
  const suggestions = catalog.filter((p) => p.category !== 'prep' && !inBag.has(p.id)).slice(0, SUGGESTION_COUNT);
  const totalCents = computeOrderTotalCents(state.lines);

  return (
    <MistBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 130 + insets.bottom }}>
        <AppHeader
          title="My bag"
          onBack={onBack}
          trailing={<Caption>{count} {count === 1 ? 'item' : 'items'}</Caption>}
        />
        <View className="gap-3 px-6">
          {state.lines.map((l) => <LineCard key={lineKey(l)} line={l} />)}
        </View>
        {suggestions.length ? <FinishYourLook products={suggestions} /> : null}
        <View className="mt-5 px-6">
          <GlassCard testID="bag-summary" radius={22} className="px-[18px] py-3.5">
            <View className="flex-row justify-between">
              <Text className="font-display text-[18px] text-ink">Total</Text>
              <Text className="font-display text-[18px] text-ink">{formatCents(totalCents)}</Text>
            </View>
            <Caption className="mt-2 text-[11px] text-ink-faint">{SAMPLE_CATALOG_LABEL}</Caption>
          </GlassCard>
        </View>
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-ink-faint/20 bg-mist-50/95 px-5 pt-3"
        style={{ paddingBottom: 16 + insets.bottom }}
      >
        <PrimaryButton label={`Checkout · ${formatCents(totalCents)}`} fullWidth onPress={onCheckout} />
      </View>
    </MistBackground>
  );
}

function shadeColor(line: BagLine): string | undefined {
  if (!line.shade) return undefined;
  return shadeOptions(line.product).find((o) => o.label === line.shade)?.color;
}

function LineCard({ line }: { line: BagLine }) {
  const { line: brandLine, title } = productLine(line.product);
  const key = lineKey(line);
  const swatch = shadeColor(line);
  const describe = line.shade ? `${line.product.name}, ${line.shade}` : line.product.name;
  return (
    <GlassCard radius={22} className="flex-row gap-3 p-2.5">
      <View style={{ width: 86 }}>
        <ProductArt product={line.product} height={100} radius={16} />
      </View>
      <View className="flex-1 pr-0.5 pt-0.5">
        <View className="flex-row justify-between gap-2">
          <Eyebrow>{brandLine ?? ''}</Eyebrow>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Remove ${describe}`}
            onPress={() => bag.setQty(key, 0)}
            hitSlop={10}
          >
            <TrashGlyph color={palette.inkSoft} size={15} />
          </PressableScale>
        </View>
        <Text className="mt-0.5 font-display-md text-[14.5px] leading-[19px] text-ink">{title}</Text>
        {line.shade ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            {swatch ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatch }} /> : null}
            <Caption>{line.shade}</Caption>
          </View>
        ) : null}
        <View className="mt-auto flex-row items-center justify-between pt-1.5">
          <Text className="font-body-bold text-[15px] text-ink">${line.product.price * line.qty}</Text>
          <Stepper small value={line.qty} min={0} label={`Quantity, ${describe}`} onChange={(q) => bag.setQty(key, q)} />
        </View>
      </View>
    </GlassCard>
  );
}

function FinishYourLook({ products }: { products: readonly Product[] }) {
  return (
    <View className="mt-6 px-6">
      <Text className="font-display text-[18px] text-ink">Finish your look</Text>
      <Caption className="mb-2.5 mt-0.5">Goes well with your bag</Caption>
      <GlassCard radius={22} className="px-3.5 py-1">
        {products.map((p, i) => (
          <View key={p.id} className={'flex-row items-center gap-3 py-2.5' + (i ? ' border-t border-ink-faint/20' : '')}>
            <View style={{ width: 44 }}>
              <ProductArt product={p} height={44} radius={12} />
            </View>
            <Text className="flex-1 font-body-semibold text-[14px] text-ink" numberOfLines={1}>{p.name}</Text>
            <Text className="font-body text-[13px] text-ink-soft">${p.price}</Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Add ${p.name} to bag`}
              onPress={() => bag.add(p)}
              className="rounded-full bg-brand-tint px-3.5 py-2"
            >
              <Text className="font-body-semibold text-[12px] text-brand-greenDark">Add</Text>
            </PressableScale>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}
