// src/features/allergens/FlagPicker.tsx
// Group chips + search + the current list of individually chosen names. Pure view over a profile;
// every change goes through the immutable helpers in profile.ts.
import { View } from 'react-native';
import { Body, Caption, PressableScale, SectionLabel } from '../../components/ui';
import { ALLERGEN_COPY as C } from '../../content/allergen-copy';
import { ingredientById } from '../../content/ingredients/dictionary';
import { GroupChips } from './GroupChips';
import { AllergenSearch } from './AllergenSearch';
import { addIngredient, addUnresolved, removeEntry, toggleGroup, type AllergenProfile } from './profile';

type Props = { profile: AllergenProfile; onChange: (p: AllergenProfile) => void };

export function FlagPicker({ profile, onChange }: Props) {
  const entries = [
    ...profile.ingredients.map((id) => ({ kind: 'ingredient' as const, value: id, label: ingredientById(id)?.inci ?? id })),
    ...profile.unresolved.map((u) => ({ kind: 'unresolved' as const, value: u, label: u })),
  ];
  return (
    <View className="gap-5">
      <View className="gap-3">
        <SectionLabel>{C.groupsHeading}</SectionLabel>
        <GroupChips selected={profile.groups} onToggle={(id) => onChange(toggleGroup(profile, id))} />
      </View>
      <AllergenSearch
        onPickIngredient={(id) => onChange(addIngredient(profile, id))}
        onAddName={(name) => onChange(addUnresolved(profile, name))}
      />
      {entries.map((e) => (
        <View key={`${e.kind}-${e.value}`} testID={`flag-${e.kind}-${e.value}`} className="flex-row items-center justify-between">
          <Body className="flex-1">{e.label}</Body>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={C.removeItem(e.label)}
            onPress={() => onChange(removeEntry(profile, e.kind, e.value))}
          >
            <View className="min-h-[48px] min-w-[48px] items-center justify-center">
              <Caption className="text-ink-muted">✕</Caption>
            </View>
          </PressableScale>
        </View>
      ))}
    </View>
  );
}
