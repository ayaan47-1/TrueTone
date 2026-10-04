// src/features/routine/components/RoutineProductPicker.tsx
// Bottom sheet for choosing a routine step's product. Groups the user's previously purchased
// items and saved items above the full catalog (routine-suggestions.ts). Local data only.
import { ScrollView, View } from 'react-native';
import { Body, Caption, GlassSheet, PressableScale, SectionLabel, Subheading } from '../../../components/ui';
import type { ProductSuggestion, SuggestionSource } from '../routine-suggestions';

const GROUPS: readonly { source: SuggestionSource; label: string }[] = [
  { source: 'purchased', label: 'From your orders' },
  { source: 'saved', label: 'Saved' },
  { source: 'catalog', label: 'All products' },
];

interface Props {
  title: string;
  suggestions: readonly ProductSuggestion[];
  onPick: (productId: string) => void;
  onClose: () => void;
}

export function RoutineProductPicker({ title, suggestions, onPick, onClose }: Props) {
  return (
    <GlassSheet align="bottom" onClose={onClose} className="px-6 py-6">
      <Subheading className="mb-3">{title}</Subheading>
      <ScrollView style={{ maxHeight: 400 }}>
        {GROUPS.map(({ source, label }) => {
          const items = suggestions.filter((s) => s.source === source);
          if (items.length === 0) return null;
          return (
            <View key={source} className="mb-3">
              <SectionLabel>{label}</SectionLabel>
              <View className="gap-2">
                {items.map(({ product }) => (
                  <PressableScale
                    key={product.id}
                    testID={`routine-pick-${product.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${product.name}`}
                    onPress={() => onPick(product.id)}
                  >
                    <View className="flex-row items-center gap-3 py-1.5">
                      <View
                        style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: product.color ?? '#EBE2D3' }}
                      />
                      <View className="flex-1">
                        <Body className="text-ink">{product.name}</Body>
                        {product.shadeName ? <Caption>{product.shadeName}</Caption> : null}
                      </View>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </GlassSheet>
  );
}
