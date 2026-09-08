// src/features/shop/FilterTabs.tsx
// Controlled All / Face / Eyes / Lips filter tabs for the Shop. Pure presentation —
// the parent owns the selected value and handles changes (value + onChange props).
import { View } from 'react-native';
import { PressableScale, Body } from '../../components/ui';
import { FILTERS, FILTER_LABELS, type Filter } from '../../content/makeup-vocab';

interface FilterTabsProps {
  value: Filter;
  onChange: (next: Filter) => void;
}

/** Segmented shade-category filter for the Shop list. */
export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <View className="flex-row flex-wrap gap-2.5" testID="filter-tabs">
      {FILTERS.map((filter) => {
        const on = value === filter;
        return (
          <PressableScale
            key={filter}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(filter)}
          >
            <View
              className={
                'rounded-full border px-4 py-2 ' +
                (on ? 'bg-brand-green border-brand-green' : 'bg-transparent border-ink-faint')
              }
            >
              <Body className={on ? 'text-white' : 'text-ink-soft'}>{FILTER_LABELS[filter]}</Body>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
