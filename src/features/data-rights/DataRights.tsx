import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Screen, GlassCard, Display, Eyebrow, Body, Caption } from '../../components/ui';

type RpcName = 'withdraw_consent' | 'delete_my_data' | 'delete_account';
type Props = { onChanged: () => void; confirm: (msg: string) => Promise<boolean> };

const ACTIONS: { id: string; rpc: RpcName; label: string; hint: string; danger?: boolean; confirm: string }[] = [
  { id: 'withdraw', rpc: 'withdraw_consent', label: 'Withdraw Consent', hint: 'Stop future scans until you consent again.', confirm: 'Withdraw consent?' },
  { id: 'delete-data', rpc: 'delete_my_data', label: 'Delete My Data', hint: 'Erase your scans and derived scores.', confirm: 'Delete all your data?' },
  { id: 'delete-account', rpc: 'delete_account', label: 'Delete Account', hint: 'Permanently remove your account.', danger: true, confirm: 'Delete your account permanently?' },
];

export function DataRights({ onChanged, confirm }: Props) {
  async function run(fn: RpcName, msg: string) {
    if (!(await confirm(msg))) return;
    const { error } = await supabase.rpc(fn);
    if (!error) onChanged();
  }
  return (
    <Screen className="px-6" contentStyle={{ paddingTop: 8 }}>
      <View className="gap-2 mb-6 mt-2">
        <Eyebrow>You’re in control</Eyebrow>
        <Display className="text-3xl">Your Data</Display>
      </View>
      <View className="gap-3">
        {ACTIONS.map((a) => (
          <Pressable
            key={a.id}
            testID={a.id}
            accessibilityRole="button"
            onPress={() => run(a.rpc, a.confirm)}
          >
            {({ pressed }) => (
              <GlassCard flat intensity={28} radius={22} className="px-5 py-4 gap-1" style={{ opacity: pressed ? 0.7 : 1 }}>
                <Text className={`font-body-semibold text-base ${a.danger ? 'text-clay' : 'text-ink'}`}>{a.label}</Text>
                <Caption>{a.hint}</Caption>
              </GlassCard>
            )}
          </Pressable>
        ))}
      </View>
      <Body className="text-xs text-ink-muted mt-6 px-1">
        Your face image never leaves your phone. These controls also clear derived scores held on our
        servers.
      </Body>
    </Screen>
  );
}
