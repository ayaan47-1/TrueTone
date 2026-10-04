// src/features/routine/components/RoutineEditor.tsx
// Routine-page editor for the user's AM/PM routine: add, edit (swap the product) and remove
// steps. Same on-device data as the Account logger (useDailyRoutine), so both stay in sync.
// The picker puts previously purchased and saved items first. No backend, no network.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Body, Caption, GlassCard, PressableScale, Subheading } from '../../../components/ui';
import { catalog } from '../../match/product-catalog';
import { useDailyRoutine } from '../use-daily-routine';
import { suggestProducts } from '../routine-suggestions';
import type { RoutineSlot } from '../routine-types';
import { RoutineProductPicker } from './RoutineProductPicker';

const SLOTS: readonly { key: RoutineSlot; label: string }[] = [
  { key: 'am', label: 'Morning' },
  { key: 'pm', label: 'Evening' },
];

/** What the picker is open for: a new step, or editing an existing one. */
type PickerTarget = { slot: RoutineSlot; editing?: string };

function productName(id: string): string {
  return catalog.find((p) => p.id === id)?.name ?? id;
}

interface Props {
  userId: string | null;
  purchasedIds: readonly string[];
  savedIds: readonly string[];
}

export function RoutineEditor({ userId, purchasedIds, savedIds }: Props) {
  const { today, addToSlot, removeFromSlot, replaceInSlot } = useDailyRoutine(userId);
  const [target, setTarget] = useState<PickerTarget | null>(null);

  const suggestions = useMemo(
    () => (target ? suggestProducts({ purchasedIds, savedIds, exclude: today[target.slot] }) : []),
    [target, purchasedIds, savedIds, today],
  );

  const onPick = (productId: string): void => {
    if (!target) return;
    if (target.editing) replaceInSlot(target.slot, target.editing, productId);
    else addToSlot(target.slot, productId);
    setTarget(null);
  };

  return (
    <View className="gap-3">
      {SLOTS.map(({ key, label }) => (
        <GlassCard key={key} flat radius={22} className="px-5 py-4">
          <View className="flex-row items-center justify-between">
            <Subheading className="text-[16px]">{label}</Subheading>
            <PressableScale
              testID={`routine-add-${key}`}
              accessibilityRole="button"
              accessibilityLabel={`Add a ${label.toLowerCase()} step`}
              hitSlop={8}
              onPress={() => setTarget({ slot: key })}
            >
              <Caption className="font-body-semibold text-sage">+ Add step</Caption>
            </PressableScale>
          </View>
          {today[key].length === 0 ? (
            <Caption className="mt-1 text-ink-soft">No steps yet</Caption>
          ) : (
            today[key].map((id, i) => (
              <View key={id} className="mt-2 flex-row items-center gap-3">
                <Caption className="w-5 text-ink-muted">{`${i + 1}.`}</Caption>
                <Body className="flex-1 text-ink">{productName(id)}</Body>
                <PressableScale
                  testID={`routine-edit-${key}-${id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${productName(id)}`}
                  hitSlop={8}
                  onPress={() => setTarget({ slot: key, editing: id })}
                >
                  <Caption className="text-sage">Edit</Caption>
                </PressableScale>
                <PressableScale
                  testID={`routine-remove-${key}-${id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${productName(id)} from ${label}`}
                  hitSlop={8}
                  onPress={() => removeFromSlot(key, id)}
                >
                  <Caption className="text-ink-muted">Remove</Caption>
                </PressableScale>
              </View>
            ))
          )}
        </GlassCard>
      ))}

      {target ? (
        <RoutineProductPicker
          title={target.editing ? `Change ${productName(target.editing)}` : `Add to ${target.slot === 'am' ? 'Morning' : 'Evening'}`}
          suggestions={suggestions}
          onPick={onPick}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </View>
  );
}
