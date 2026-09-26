// src/features/routine/components/RoutineLogger.tsx
// Account-screen "My Daily Routine" logger: AM/PM product logging from the real shop catalog,
// plus one-tap publication into the local Community Routines feed. On-device only -- no backend,
// no network. Products come from src/features/match/product-catalog; publishing reuses the Task-12
// CommunityRoutine types.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Body,
  Caption,
  GlassCard,
  GlassSheet,
  PressableScale,
  PrimaryButton,
  SectionLabel,
  Subheading,
} from '../../../components/ui';
import { catalog } from '../../match/product-catalog';
import type { CommunityProfile } from '../../identity/community-profile-types';
import { useDailyRoutine } from '../use-daily-routine';
import type { RoutineSlot } from '../routine-types';

interface RoutineLoggerProps {
  userId: string | null;
  profile: CommunityProfile | null;
}

const SLOTS: readonly { key: RoutineSlot; label: string }[] = [
  { key: 'am', label: 'Morning' },
  { key: 'pm', label: 'Evening' },
];

function productName(id: string): string {
  return catalog.find((p) => p.id === id)?.name ?? id;
}

export function RoutineLogger({ userId, profile }: RoutineLoggerProps) {
  const { today, summary, addToSlot, removeFromSlot, publish } = useDailyRoutine(userId);
  const [pickerSlot, setPickerSlot] = useState<RoutineSlot | null>(null);
  const [published, setPublished] = useState(false);

  const canPublish = !!profile && summary.todayCount > 0;

  async function onPublish() {
    if (!profile) return;
    const ok = await publish(profile);
    if (ok) setPublished(true);
  }

  return (
    <GlassCard flat radius={22} className="px-5 py-4">
      <SectionLabel>My Daily Routine</SectionLabel>

      {SLOTS.map(({ key, label }) => (
        <View key={key} className="mb-3">
          <View className="flex-row items-center justify-between">
            <Subheading className="text-[16px]">{label}</Subheading>
            <PressableScale
              testID={`routine-add-${key}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${label} product`}
              onPress={() => {
                setPublished(false);
                setPickerSlot(key);
              }}
            >
              <Caption className="text-sage font-body-semibold">Add</Caption>
            </PressableScale>
          </View>

          {today[key].length === 0 ? (
            <Caption className="text-ink-soft mt-1">Nothing logged</Caption>
          ) : (
            <View className="gap-1 mt-1">
              {today[key].map((id) => (
                <View key={id} className="flex-row items-center justify-between">
                  <Body className="text-ink flex-1">{productName(id)}</Body>
                  <PressableScale
                    testID={`routine-remove-${key}-${id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${productName(id)} from ${label}`}
                    hitSlop={8}
                    onPress={() => {
                      setPublished(false);
                      removeFromSlot(key, id);
                    }}
                  >
                    <Caption className="text-ink-muted">Remove</Caption>
                  </PressableScale>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <View className="mt-1">
        <PrimaryButton
          testID="routine-publish"
          label="Publish to Community"
          variant="glass"
          disabled={!canPublish}
          onPress={() => {
            void onPublish();
          }}
        />
        {published ? (
          <Caption testID="routine-published" className="text-sage mt-2 text-center">
            Shared to Community
          </Caption>
        ) : null}
        {!profile ? (
          <Caption className="text-ink-soft mt-2 text-center">
            Choose a username above to share your routine.
          </Caption>
        ) : null}
      </View>

      {pickerSlot ? (
        <GlassSheet align="bottom" onClose={() => setPickerSlot(null)} className="px-6 py-6">
          <Subheading className="mb-3">
            Add to {pickerSlot === 'am' ? 'Morning' : 'Evening'}
          </Subheading>
          <ScrollView style={{ maxHeight: 360 }}>
            <View className="gap-2">
              {catalog.map((product) => (
                <PressableScale
                  key={product.id}
                  testID={`routine-pick-${product.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.name}`}
                  onPress={() => {
                    addToSlot(pickerSlot, product.id);
                    setPickerSlot(null);
                  }}
                >
                  <View className="flex-row items-center gap-3 py-1.5">
                    <View
                      style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: product.color ?? '#EBE2D3' }}
                    />
                    <Body className="text-ink flex-1">{product.name}</Body>
                  </View>
                </PressableScale>
              ))}
            </View>
          </ScrollView>
        </GlassSheet>
      ) : null}
    </GlassCard>
  );
}
