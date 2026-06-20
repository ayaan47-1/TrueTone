import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ChatScreen } from '../../src/features/recommend/ChatScreen';
import { MistBackground, GlassCard, Body } from '../../src/components/ui';

export default function ChatRoute() {
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  if (!scanId) {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center" radius={32}>
            <Body className="text-center">No scan yet — run a scan to ask about your routine.</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );
  }
  return <ChatScreen scanId={scanId} />;
}
