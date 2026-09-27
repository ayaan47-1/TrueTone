// src/features/allergens/AllergenSearch.tsx
// Search the starter dictionary (design §3.2). The user picks a result and we store its id; an
// unmatched name is kept as typed (exact-name match only, C13) if it passes validateFreeText.
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Caption, PressableScale } from '../../components/ui';
import { TextField } from '../../components/ui/TextField';
import { ALLERGEN_COPY as C } from '../../content/allergen-copy';
import { searchIngredients, validateFreeText } from './search';

type Props = { onPickIngredient: (id: string) => void; onAddName: (name: string) => void };

export function AllergenSearch({ onPickIngredient, onAddName }: Props) {
  const [query, setQuery] = useState('');
  const [rejected, setRejected] = useState(false);
  const results = searchIngredients(query);
  const hasQuery = query.trim().length > 0;

  const change = (t: string) => {
    setQuery(t);
    setRejected(false);
  };
  const pick = (id: string) => {
    onPickIngredient(id);
    change('');
  };
  const addTyped = () => {
    const v = validateFreeText(query);
    if (!v.ok) {
      setRejected(true);
      return;
    }
    onAddName(v.value);
    change('');
  };

  return (
    <View className="gap-2">
      <TextField
        testID="allergen-search"
        label={C.searchLabel}
        placeholder={C.searchPlaceholder}
        value={query}
        onChangeText={change}
        autoCapitalize="none"
        error={rejected ? C.freeTextRejected : undefined}
      />
      {results.map((i) => (
        <PressableScale key={i.id} testID={`result-${i.id}`} accessibilityRole="button" onPress={() => pick(i.id)}>
          <View className="min-h-[48px] justify-center px-2">
            <Body>{i.inci}</Body>
          </View>
        </PressableScale>
      ))}
      {hasQuery && results.length === 0 ? (
        <View className="gap-1">
          <Caption className="text-ink-muted">{C.searchNoMatch}</Caption>
          <PressableScale accessibilityRole="button" onPress={addTyped}>
            <View className="min-h-[48px] justify-center px-2">
              <Body className="text-ink-soft underline">{C.addTyped}</Body>
            </View>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}
