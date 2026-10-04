import { useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { clearDiary } from '../diary/diary-storage';
import { clearAllRoutines } from '../routine/routine-storage';
import { orderHistory } from '../checkout/order-history-store';
import { clearPublishedRoutines } from '../routine/routine-publish';
import { Screen, GlassCard, Display, Eyebrow, Body, Caption } from '../../components/ui';

type RpcName = 'withdraw_consent' | 'delete_my_data' | 'delete_account';
type Props = { onChanged: () => void; confirm: (msg: string) => Promise<boolean> };

const ACTIONS: { id: string; rpc: RpcName; label: string; hint: string; danger?: boolean; confirm: string }[] = [
  { id: 'withdraw', rpc: 'withdraw_consent', label: 'Withdraw Consent', hint: 'Stop future scans until you consent again.', confirm: 'Withdraw consent?' },
  { id: 'delete-data', rpc: 'delete_my_data', label: 'Delete My Data', hint: 'Erase your scans and derived scores.', confirm: 'Delete all your data?' },
  { id: 'delete-account', rpc: 'delete_account', label: 'Delete Account', hint: 'Permanently remove your account.', danger: true, confirm: 'Delete your account permanently?' },
];

// On-device data the server never sees: the skin-feel diary, the daily-routine tracker + its
// locally published Community routines, and the order history. All must go for deletion to be complete.
const LOCAL_WIPES: (() => Promise<void>)[] = [
  () => orderHistory.clear(),
  clearDiary,
  clearAllRoutines,
  clearPublishedRoutines,
];

/** Runs every wipe even if one fails; true only when all of them succeeded. */
async function wipeLocalData(): Promise<boolean> {
  const results = await Promise.allSettled(LOCAL_WIPES.map((wipe) => wipe()));
  return results.every((r) => r.status === 'fulfilled');
}

export function DataRights({ onChanged, confirm }: Props) {
  const [wipeIncomplete, setWipeIncomplete] = useState(false);

  const wiping = useRef(false);

  async function finishLocalWipe() {
    // Single-flight: a double tap on Try again must not run two overlapping wipes.
    if (wiping.current) return;
    wiping.current = true;
    const ok = await wipeLocalData().finally(() => {
      wiping.current = false;
    });
    setWipeIncomplete(!ok);
    // Never report the deletion as done while on-device data is left behind.
    if (ok) onChanged();
  }

  async function run(fn: RpcName, msg: string) {
    if (!(await confirm(msg))) return;
    const { error } = await supabase.rpc(fn);
    if (error) return;
    // The account row is gone but the cached session still holds its token; drop it so the
    // refresh below starts a fresh anonymous session instead of failing on the deleted user.
    // A failed sign-out must not skip the on-device wipe.
    if (fn === 'delete_account') await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    if (fn === 'delete_my_data' || fn === 'delete_account') return finishLocalWipe();
    onChanged();
  }
  return (
    <Screen className="px-6" topGap={8}>
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
      {wipeIncomplete && (
        <GlassCard flat intensity={28} radius={22} className="px-5 py-4 gap-2 mt-4">
          <Text accessibilityRole="alert" className="font-body-semibold text-base text-clay">
            Deletion incomplete
          </Text>
          <Caption>Your server data is gone, but some data on this phone couldn’t be cleared.</Caption>
          <Pressable testID="retry-wipe" accessibilityRole="button" onPress={() => void finishLocalWipe()}>
            <Text className="font-body-semibold text-base text-ink">Try again</Text>
          </Pressable>
        </GlassCard>
      )}
      <Body className="text-xs text-ink-muted mt-6 px-1">
        Your face image never leaves your phone. These controls also clear derived scores held on our
        servers.
      </Body>
    </Screen>
  );
}
