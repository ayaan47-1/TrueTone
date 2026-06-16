import { View, Text } from 'react-native';

export function Onboarding() {
  return (
    <View className="flex-1 p-6 gap-4 justify-center">
      <Text className="text-2xl font-bold">TrueTone</Text>
      <Text className="text-xs text-gray-600">
        TrueTone is a cosmetic and general-wellness tool. It is not a medical device, does not
        diagnose, treat, or prevent any disease or condition, and is not a substitute for
        professional medical advice. Results are AI-generated estimates of your skin&rsquo;s
        appearance. For any skin concern &mdash; or any new, changing, or unusual spot &mdash;
        please consult a board-certified dermatologist.
      </Text>
    </View>
  );
}
