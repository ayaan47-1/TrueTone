import { View } from 'react-native';
import { MakeupChatScreen } from '../../src/features/recommend/MakeupChatScreen';
import { usePersonalization } from '../../src/features/session/personalization';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';
import { MistBackground, GlassCard, Body } from '../../src/components/ui';

// Explicit entry into the makeup / shade Q&A domain. The derived shade lives in the session
// personalization store (descriptors only — never the image); preferences are the structured
// Setup answers. With no shade in hand yet, we prompt a scan rather than open the chat.
export default function ShadeChatRoute() {
  const { currentShade } = usePersonalization();
  if (!currentShade) {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center" radius={32}>
            <Body className="text-center">No shade yet — run a scan to ask about your shade and makeup.</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );
  }
  const preferences = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  return <MakeupChatScreen shade={currentShade} preferences={preferences} />;
}
