import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { sendChat, type ChatTurn } from '../../lib/routine-chat';

interface ChatScreenProps {
  scanId: string;
}

export function ChatScreen({ scanId }: ChatScreenProps) {
  const [history, setHistory] = useState<ChatTurn[]>([]); // session-only; cleared on unmount
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSend() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true); setError(false);
    const nextHistory: ChatTurn[] = [...history, { role: 'user', content: message }];
    setHistory(nextHistory); setInput('');
    try {
      const { reply } = await sendChat(scanId, message, history);
      setHistory([...nextHistory, { role: 'assistant', content: reply }]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 p-4">
      <ScrollView className="flex-1">
        {history.map((m, i) => (
          <Text key={i} className={m.role === 'user' ? 'text-right mb-2' : 'mb-2'}>{m.content}</Text>
        ))}
        {error && <Text className="text-red-600">Couldn't load a reply right now — please try again.</Text>}
      </ScrollView>
      <View className="flex-row items-center mt-2">
        <TextInput
          className="flex-1 border rounded px-3 py-2"
          placeholder="Ask about your routine"
          value={input}
          onChangeText={setInput}
        />
        <Pressable onPress={onSend} className="ml-2 px-4 py-2 bg-black rounded">
          <Text className="text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
