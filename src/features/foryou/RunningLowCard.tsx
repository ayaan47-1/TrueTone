// src/features/foryou/RunningLowCard.tsx
// "Running low" (kit RunningLow3): items to restock, each with a Reorder button that adds
// the product to the bag. Runs on SAMPLE items (home-sample-data.ts) until a real refill
// signal exists.
import { Text, View } from 'react-native';
import { Caption, GlassCard, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { bag } from '../checkout/bag-store';
import { ProductArt } from '../shop/ProductArt';
import { SectionHead } from './HomeV3Parts';
import { SAMPLE_RUNNING_LOW } from './home-sample-data';

export function RunningLowCard() {
  return (
    <GlassCard radius={26} className="px-[18px] pb-2 pt-4">
      <SectionHead title="Running low" sub="Restock before you run out" />
      {SAMPLE_RUNNING_LOW.map(({ product, note, urgent }, i) => (
        <View
          key={product.id}
          className="flex-row items-center gap-3 py-2.5"
          style={i ? { borderTopWidth: 1, borderTopColor: 'rgba(168,159,143,0.18)' } : undefined}
        >
          <View style={{ width: 48 }}>
            <ProductArt product={product} height={48} radius={14} />
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-body-semibold text-[14px] text-ink">
              {product.name}
            </Text>
            <Caption style={{ color: urgent ? palette.clayInk : palette.inkMuted }}>{note}</Caption>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${product.name}`}
            onPress={() => bag.add(product)}
            className="rounded-full bg-brand-tint px-3.5 py-2"
          >
            <Text className="font-body-semibold text-[12px]" style={{ color: palette.sageInk }}>
              Reorder
            </Text>
          </PressableScale>
        </View>
      ))}
    </GlassCard>
  );
}
