// src/features/shop/FilterSheet.tsx
// v3 "Sort & filter" sheet (kit Sheets3 'filter', frame t-07): SORT BY chips, FINISH chips,
// Reset / Show results. The sheet holds a draft and hands it back only on "Show results".
// "Top rated" ranks by SAMPLE ratings, so it is offered only when those are enabled.
import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { GlassSheet, PrimaryButton, PressableScale, Subheading, Eyebrow } from '../../components/ui';
import { FINISH_LABELS } from '../../content/makeup-vocab';
import type { FinishFilter, ShelfSort } from './shelf';

const FINISH_CHIPS: readonly FinishFilter[] = ['any', 'natural', 'satin', 'dewy', 'matte'];

interface FilterSheetProps {
  visible: boolean;
  sort: ShelfSort;
  finish: FinishFilter;
  /** "Best match" once there is a scan to rank by, "Featured" before. */
  scanned: boolean;
  showRatingSort: boolean;
  onApply: (sort: ShelfSort, finish: FinishFilter) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, sort, finish, scanned, showRatingSort, onApply, onClose }: FilterSheetProps) {
  const [draftSort, setDraftSort] = useState(sort);
  const [draftFinish, setDraftFinish] = useState(finish);
  useEffect(() => {
    if (visible) {
      setDraftSort(sort);
      setDraftFinish(finish);
    }
  }, [visible, sort, finish]);

  const sorts: [ShelfSort, string][] = [
    ['match', scanned ? 'Best match' : 'Featured'],
    ...(showRatingSort ? ([['rating', 'Top rated']] as [ShelfSort, string][]) : []),
    ['price', 'Price'],
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GlassSheet align="bottom" onClose={onClose} className="px-[22px] pb-[22px] pt-[26px]">
        <Subheading>Sort & filter</Subheading>
        <Label text="Sort by" />
        <View className="mt-2.5 flex-row flex-wrap gap-2">
          {sorts.map(([k, l]) => (
            <Chip key={k} label={l} selected={draftSort === k} onPress={() => setDraftSort(k)} />
          ))}
        </View>
        <Label text="Finish" />
        <View className="mt-2.5 flex-row flex-wrap gap-2">
          {FINISH_CHIPS.map((f) => (
            <Chip
              key={f}
              label={f === 'any' ? 'Any' : FINISH_LABELS[f]}
              selected={draftFinish === f}
              onPress={() => setDraftFinish(f)}
            />
          ))}
        </View>
        <View className="mt-6 flex-row gap-2.5">
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Reset"
              variant="glass"
              fullWidth
              onPress={() => {
                setDraftSort('match');
                setDraftFinish('any');
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <PrimaryButton label="Show results" fullWidth onPress={() => onApply(draftSort, draftFinish)} />
          </View>
        </View>
      </GlassSheet>
    </Modal>
  );
}

function Label({ text }: { text: string }) {
  return <Eyebrow className="mt-5">{text}</Eyebrow>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}>
      <View className={'rounded-full border px-4 py-2 ' + (selected ? 'border-brand-green bg-brand-green' : 'border-ink-faint bg-transparent')}>
        <Text className={'font-body-medium text-[14px] ' + (selected ? 'text-white' : 'text-ink-soft')}>{label}</Text>
      </View>
    </PressableScale>
  );
}
