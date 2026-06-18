import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export function Onboarding() {
  const router = useRouter();
  return (
    <View className="flex-1 p-6 gap-5 justify-center">
      <View className="gap-1">
        <Text className="text-3xl font-bold tracking-tight">TrueTone</Text>
        <Text className="text-base text-gray-500">An honest, skin-tone-fair read of your skin.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        className="bg-violet-600 active:bg-violet-700 rounded-2xl py-4 items-center"
        onPress={() => router.push('/scan')}
      >
        <Text className="text-white text-base font-semibold">Start your read</Text>
      </Pressable>

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
