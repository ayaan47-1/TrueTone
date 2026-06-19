import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { sendChat, type ChatTurn } from '../../lib/routine-chat';

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
    <View className="flex-1 p-4">
      <ScrollView className="flex-1">
        {history.map((m, i) =>
          m.referred ? (
            <View
              key={i}
              testID="referral-card"
              accessibilityRole="text"
              className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3"
            >
              <Text className="font-semibold mb-1">This isn&rsquo;t a diagnosis</Text>
              <Text>{m.content}</Text>
            </View>
          ) : (
            <Text key={i} className={m.role === 'user' ? 'text-right mb-2' : 'mb-2'}>
              {m.content}
            </Text>
          ),
        )}
        {busy && (
          <Text testID="sending-indicator" className="text-gray-400 italic mb-2">
            Sending…
          </Text>
        )}
        {error && (
          <Text className="text-red-600">Couldn&apos;t load a reply right now — please try again.</Text>
        )}
      </ScrollView>
      <View className="flex-row items-center mt-2">
        <TextInput
          className="flex-1 border rounded px-3 py-2"
          placeholder="Ask about your routine"
          value={input}
          onChangeText={setInput}
          editable={!busy}
        />
        <Pressable onPress={onSend} disabled={busy} className="ml-2 px-4 py-2 bg-black rounded">
          <Text className="text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
