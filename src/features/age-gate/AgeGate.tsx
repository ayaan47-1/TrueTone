import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeIs18Plus } from './age';

export function AgeGate({ userId, onPass }: { userId: string; onPass: () => void }) {
  const [value, setValue] = useState('');
  const [blocked, setBlocked] = useState(false);
  async function submit() {
    const dob = new Date(value);
    if (isNaN(dob.getTime())) { setBlocked(false); return; }
    if (!computeIs18Plus(dob, new Date())) { setBlocked(true); return; } // discard DOB
    await supabase.from('profiles')
      .update({ is_18_plus: true, age_verified_at: new Date().toISOString() })
      .eq('id', userId);
    onPass();
  }
  if (blocked) return <View className="flex-1 items-center justify-center p-6"><Text>TrueTone is available to adults 18 and over.</Text></View>;
  return (
    <View className="flex-1 justify-center p-6 gap-4">
      <Text className="text-lg font-semibold">Enter your date of birth</Text>
      <TextInput testID="dob-input" placeholder="YYYY-MM-DD" value={value} onChangeText={setValue}
        className="border rounded p-3" autoCapitalize="none" />
      <Pressable testID="dob-submit" onPress={submit} className="bg-black rounded p-3">
        <Text className="text-white text-center">Continue</Text>
      </Pressable>
    </View>
  );
}
