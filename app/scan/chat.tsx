import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';
import { ChatScreen } from '../../src/features/recommend/ChatScreen';

export default function ChatRoute() {
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  if (!scanId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-gray-600">No scan yet — run a scan to ask about your routine.</Text>
      </View>
    );
  }
  return <ChatScreen scanId={scanId} />;
}
