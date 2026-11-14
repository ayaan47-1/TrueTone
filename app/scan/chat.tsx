import { ChatScreen } from '../../src/features/recommend/ChatScreen';
import { ROUTINE_CHAT_AVAILABLE } from '../../src/features/recommend/chat/availability';
import { Screen, HEADER_CLEARANCE, GlassCard, Body } from '../../src/components/ui';

export default function ChatRoute() {
  if (!ROUTINE_CHAT_AVAILABLE) {
    return (
      <Screen topGap={HEADER_CLEARANCE} className="px-6">
        <GlassCard className="px-7 py-8 items-center" radius={32}>
          <Body className="text-center">Routine chat is not available yet.</Body>
        </GlassCard>
      </Screen>
    );
  }
  return <ChatScreen />;
}
