// src/features/allergens/GroupChips.tsx
// The 10 groups as multi-select chips — the same control as app/setup/skips.tsx (Pam F4).
// Referral-only groups (latex, PPD) never select; they show a see-a-doctor note instead.
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Caption, PressableScale } from '../../components/ui';
import { ALLERGEN_GROUPS, type AllergenGroupId } from '../../content/ingredients/allergen-groups';
import { ALLERGEN_COPY } from '../../content/allergen-copy';

type Props = { selected: readonly AllergenGroupId[]; onToggle: (id: AllergenGroupId) => void };

export function GroupChips({ selected, onToggle }: Props) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2.5">
        {ALLERGEN_GROUPS.map((g) => {
          const on = selected.includes(g.id);
          return (
            <PressableScale
              key={g.id}
              testID={`group-${g.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => (g.referralOnly ? setNote(g.label) : onToggle(g.id))}
            >
              <View
                className={
                  'min-h-[48px] justify-center rounded-full border px-4 py-2.5 ' +
                  (on ? 'bg-brand-green border-brand-green' : 'bg-transparent border-ink-faint')
                }
              >
                <Body className={on ? 'text-white' : 'text-ink-soft'}>{g.label}</Body>
              </View>
            </PressableScale>
          );
        })}
      </View>
      {note ? (
        <Caption accessibilityLiveRegion="polite" className="text-ink-soft">
          {ALLERGEN_COPY.referralNote(note)}
        </Caption>
      ) : null}
    </View>
  );
}
