import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { sendChat, type ChatTurn } from '../../lib/routine-chat';
import { MistBackground, GlassCard, Body } from '../../components/ui';
import { useInsets } from '../../components/ui/use-insets';
import { palette } from '../../theme/tokens';

interface ChatScreenProps {
  scanId: string;
}

// UI-only message model. `referred` drives the distinct referral card and is NEVER sent to the
// backend (the wire format is ChatTurn = { role, content }).
type Msg = { role: 'user' | 'assistant'; content: string; referred?: boolean };

export function ChatScreen({ scanId }: ChatScreenProps) {
  const [history, setHistory] = useState<Msg[]>([]); // session-only; cleared on unmount
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useInsets();

  async function onSend() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(false);
    const nextHistory: Msg[] = [...history, { role: 'user', content: message }];
    setHistory(nextHistory);
    setInput('');
    // Strip the UI-only `referred` flag — the backend sees only { role, content }.
    const wire: ChatTurn[] = history.map(({ role, content }) => ({ role, content }));
    try {
      const { reply, referred } = await sendChat(scanId, message, wire);
      setHistory([...nextHistory, { role: 'assistant', content: reply, referred }]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MistBackground>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }} className="px-4">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {history.map((m, i) =>
            m.referred ? (
              <View key={i} testID="referral-card" accessibilityRole="text" className="mb-3">
                <GlassCard flat intensity={34} radius={20} className="px-4 py-3" style={{ borderColor: palette.rose300 }}>
                  <Text className="font-body-semibold text-ink mb-1">This isn&rsquo;t a diagnosis</Text>
                  <Body>{m.content}</Body>
                </GlassCard>
              </View>
            ) : m.role === 'user' ? (
              <View key={i} className="self-end mb-3 max-w-[82%]">
                <View style={styles.userBubble}>
                  <Text className="font-body text-[15px] text-white">{m.content}</Text>
                </View>
              </View>
            ) : (
              <View key={i} className="self-start mb-3 max-w-[85%]">
                <GlassCard flat intensity={30} radius={20} className="px-4 py-2.5">
                  <Body className="text-ink">{m.content}</Body>
                </GlassCard>
              </View>
            ),
          )}
          {busy && (
            <Text testID="sending-indicator" className="font-display-italic text-ink-muted mb-2 px-1">
              Sending…
            </Text>
          )}
          {error && (
            <Text className="font-body-medium text-clay px-1">Couldn&apos;t load a reply right now — please try again.</Text>
          )}
        </ScrollView>

        <View className="flex-row items-center gap-2 mt-2">
          <TextInput
            className="flex-1 rounded-full border border-white/70 bg-white/60 px-4 py-3 font-body text-[15px] text-ink"
            placeholder="Ask about your routine"
            placeholderTextColor={palette.inkFaint}
            value={input}
            onChangeText={setInput}
            editable={!busy}
          />
          <Pressable onPress={onSend} disabled={busy} style={[styles.send, busy && { opacity: 0.5 }]}>
            <Text className="font-body-semibold text-white">Send</Text>
          </Pressable>
        </View>
      </View>
    </MistBackground>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    backgroundColor: palette.mauve500,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  send: {
    backgroundColor: palette.mauve600,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
