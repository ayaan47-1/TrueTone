import { ScrollView, View } from 'react-native';
import { Body, SectionLabel, GlassCard } from '../../components/ui';

export interface PickedForYouItem {
  id: string;
  name: string;
}

export interface PickedForYouProps {
  /** Items to render in the horizontal rail. */
  items: PickedForYouItem[];
}

/**
 * Today-home "Picked for you" horizontal rail (SHELL). Renders a row of
 * simple cosmetic-product cards. No scoring/data — props-driven only.
 */
export function PickedForYou({ items }: PickedForYouProps) {
  return (
    <View>
      <SectionLabel>Picked for you</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 -mx-1">
        {items.map((item) => (
          <GlassCard key={item.id} className="mx-1 p-4 w-32">
            <Body className="text-ink-soft" numberOfLines={2}>
              {item.name}
            </Body>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}
