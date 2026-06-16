import { View, Text } from 'react-native';

export default function RegionBlocked() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-center">
        TrueTone is not available in your region.
      </Text>
    </View>
  );
}
