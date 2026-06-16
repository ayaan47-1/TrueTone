// src/features/read/Result.tsx
import { View, Text, ScrollView } from 'react-native';
import { DIMENSIONS, SKIN_TYPE_LABELS, type Dimension, type SkinTypeFeel } from '../../content/cosmetic-vocab';
import { toBand, direction } from './bands';
import { assertCosmetic } from '../../lib/cosmetic-filter';
import type { ScoreVector } from './read-types';

interface ResultProps {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  prev: ScoreVector | null; // previous scan for trend arrows (null on first scan)
}

const QUALITY_DIMS: Dimension[] = ['hydration', 'oiliness', 'texture', 'pores'];
const APPEARANCE_DIMS: Dimension[] = ['darkSpots', 'redness', 'fineLines', 'darkCircles'];
const LABELS: Record<Dimension, string> = {
  hydration: 'Hydration look', oiliness: 'Oiliness', texture: 'Texture', pores: 'Pores',
  darkSpots: 'Dark spots', redness: 'Redness', fineLines: 'Fine lines', darkCircles: 'Dark circles',
};
const ARROW: Record<'up' | 'down' | 'same', string> = { up: '↑', down: '↓', same: '' };

function Row({ dim, scores, prev }: { dim: Dimension; scores: ScoreVector; prev: ScoreVector | null }) {
  const band = toBand(dim, scores[dim]);
  assertCosmetic([band.label]); // last-line compliance check before display
  const dir = direction(scores[dim], prev ? prev[dim] : null);
  return (
    <View className="flex-row justify-between px-4 py-2 border-b border-gray-100">
      <Text>{LABELS[dim]}</Text>
      <Text className="text-gray-600">{band.label} {ARROW[dir]}</Text>
    </View>
  );
}

export function Result({ scores, skinType, prev }: ResultProps) {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="bg-amber-50 px-4 py-3">
        <Text className="text-amber-800 text-xs">
          This describes how your skin looks today. It is not a medical diagnosis and TrueTone is not a medical device.
        </Text>
      </View>
      <Text className="px-4 pt-4 text-lg font-bold">Your skin today</Text>
      <Text className="px-4 pb-3 text-violet-700">Skin type feel: {SKIN_TYPE_LABELS[skinType]}</Text>

      <Text className="px-4 pt-2 pb-1 text-xs uppercase text-gray-400">Skin qualities</Text>
      {QUALITY_DIMS.map((d) => <Row key={d} dim={d} scores={scores} prev={prev} />)}

      <Text className="px-4 pt-3 pb-1 text-xs uppercase text-gray-400">Appearance of</Text>
      {APPEARANCE_DIMS.map((d) => <Row key={d} dim={d} scores={scores} prev={prev} />)}

      <View className="m-4 p-3 bg-blue-50 rounded-xl">
        <Text className="text-blue-900 text-xs">
          Notice something changing, painful, or unusual? TrueTone can&apos;t assess that — please see a dermatologist.
        </Text>
      </View>
    </ScrollView>
  );
}
