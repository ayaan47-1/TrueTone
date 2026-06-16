import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { CONSENT_COPY as C } from './consent-copy';

export function Consent({
  onConsent,
  onDecline,
}: {
  onConsent: () => void;
  onDecline: () => void;
}) {
  const [checked, setChecked] = useState(false);
  async function consent() {
    const { error } = await supabase.rpc('record_consent');
    if (!error) onConsent();
  }
  return (
    <View className="flex-1 p-6 gap-3">
      <Text className="text-xl font-bold">{C.title}</Text>
      <Text>{C.what}</Text>
      <Text>{C.purpose}</Text>
      <Text>{C.retention}</Text>
      <Pressable testID="consent-check" onPress={() => setChecked((v) => !v)}>
        <Text>
          {checked ? '☑' : '☐'} {C.checkbox}
        </Text>
      </Pressable>
      <View className="flex-row gap-3 mt-4">
        <Pressable onPress={onDecline} className="flex-1 border rounded p-3">
          <Text className="text-center">Decline</Text>
        </Pressable>
        <Pressable
          testID="consent-submit"
          disabled={!checked}
          onPress={consent}
          accessibilityState={{ disabled: !checked }}
          className={`flex-1 rounded p-3 ${checked ? 'bg-black' : 'bg-gray-300'}`}
        >
          <Text className="text-white text-center">I Consent</Text>
        </Pressable>
      </View>
    </View>
  );
}
