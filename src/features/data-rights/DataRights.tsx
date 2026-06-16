import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';

type RpcName = 'withdraw_consent' | 'delete_my_data' | 'delete_account';
type Props = { onChanged: () => void; confirm: (msg: string) => Promise<boolean> };

export function DataRights({ onChanged, confirm }: Props) {
  async function run(fn: RpcName, msg: string) {
    if (!(await confirm(msg))) return;
    const { error } = await supabase.rpc(fn);
    if (!error) onChanged();
  }
  return (
    <View className="flex-1 p-6 gap-3">
      <Text className="text-lg font-semibold">Your Data</Text>
      <Pressable
        testID="withdraw"
        onPress={() => run('withdraw_consent', 'Withdraw consent?')}
        className="border rounded p-3"
      >
        <Text>Withdraw Consent</Text>
      </Pressable>
      <Pressable
        testID="delete-data"
        onPress={() => run('delete_my_data', 'Delete all your data?')}
        className="border rounded p-3"
      >
        <Text>Delete My Data</Text>
      </Pressable>
      <Pressable
        testID="delete-account"
        onPress={() => run('delete_account', 'Delete your account permanently?')}
        className="border rounded p-3"
      >
        <Text>Delete Account</Text>
      </Pressable>
    </View>
  );
}
