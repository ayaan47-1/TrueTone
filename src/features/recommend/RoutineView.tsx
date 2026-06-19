import { View, Text, ScrollView } from 'react-native';
import type { Routine, RoutineStep } from './routine-types';

function Step({ step }: { step: RoutineStep }) {
  return (
    <View className="mb-3">
      <Text className="font-semibold">{step.category}</Text>
      <Text className="text-sm text-gray-600">{step.habit} — {step.rationale}</Text>
    </View>
  );
}

export function RoutineView({ routine }: { routine: Routine }) {
  return (
    <ScrollView className="p-4">
      <Text className="text-lg font-bold mb-2">Morning</Text>
      {routine.am.map((s, i) => <Step key={`am-${i}`} step={s} />)}
      <Text className="text-lg font-bold mb-2 mt-4">Evening</Text>
      {routine.pm.map((s, i) => <Step key={`pm-${i}`} step={s} />)}
      {routine.notes.map((n, i) => <Text key={`note-${i}`} className="mt-3 italic">{n}</Text>)}
      <Text className="mt-6 text-xs text-gray-500">
        This describes how your skin looks and suggests cosmetic habits — it is not medical advice.
      </Text>
    </ScrollView>
  );
}
