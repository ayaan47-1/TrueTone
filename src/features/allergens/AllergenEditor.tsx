// src/features/allergens/AllergenEditor.tsx
// Account → Ingredient flags (design WS-A). Edits the same on-device profile as Setup. A user who
// never consented (answered No / Skip) sees the wa_health consent sheet before the first save.
// Withdrawing consent deletes the profile on this phone and logs the withdrawal.
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Screen, HEADER_CLEARANCE, Display, Body, Caption, GlassCard, PrimaryButton } from '../../components/ui';
import { ALLERGEN_COPY as C } from '../../content/allergen-copy';
import { saveAllergenProfile } from './allergen-store';
import { flushPendingWithdrawal, withdrawHealthDataConsent } from './health-consent';
import { emptyProfile, hasHealthData, type AllergenProfile } from './profile';
import { useAllergenProfile } from './use-allergen-profile';
import { FlagPicker } from './FlagPicker';
import { HealthDataConsent } from './HealthDataConsent';

type Props = {
  userId: string | null;
  confirm?: (msg: string) => Promise<boolean>;
  onOpenPolicy?: () => void;
};

const now = () => new Date().toISOString();

export function AllergenEditor({ userId, confirm = async () => true, onOpenPolicy }: Props) {
  const loaded = useAllergenProfile(userId);
  const [draft, setDraft] = useState<AllergenProfile | null>(null);
  const [asking, setAsking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [withdrawFailed, setWithdrawFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [withdrawPending, setWithdrawPending] = useState(false);

  // Retry an offline withdrawal whenever the editor opens (code review M2).
  useEffect(() => {
    if (userId) void flushPendingWithdrawal(userId);
  }, [userId]);

  const ready = loaded.status === 'ready';
  const stored = loaded.status === 'ready' ? loaded.profile : null;

  useEffect(() => {
    if (ready) setDraft(stored ?? emptyProfile('skipped', now()));
  }, [ready, stored]);

  const consentedBefore = stored?.answer === 'yes';

  async function persist(p: AllergenProfile) {
    if (!userId) return;
    const next = { ...p, answer: 'yes' as const, updatedAt: now() };
    try {
      await saveAllergenProfile(userId, next);
    } catch {
      setSaveFailed(true); // keep the draft and the step; never show "Saved" (code review M1)
      return;
    }
    setSaveFailed(false);
    setDraft(next);
    setAsking(false);
    setSaved(true);
    loaded.reload();
  }

  function save() {
    if (!draft) return;
    if (!consentedBefore && hasHealthData(draft)) setAsking(true);
    else void persist(draft);
  }

  async function withdraw() {
    if (!userId || !(await confirm(C.editor.withdraw + '?'))) return;
    const { cleared, logged } = await withdrawHealthDataConsent(userId);
    setWithdrawFailed(!cleared);
    setWithdrawPending(!logged);
    // Reset the screen only when the flags are really gone from the phone.
    if (!cleared) return;
    setDraft(emptyProfile('skipped', now()));
    loaded.reload();
  }

  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-5 pt-4">
          <Display className="text-3xl">{C.editor.title}</Display>
          <GlassCard flat radius={22} className="px-5 py-4">
            <Caption className="text-[11px] leading-[17px] text-ink-muted">{C.disclaimer}</Caption>
          </GlassCard>
          {loaded.status === 'error' ? <Body accessibilityRole="alert">{C.loadFailed}</Body> : null}
          {withdrawPending ? <Caption className="text-ink-muted">{C.editor.withdrawPending}</Caption> : null}
          {draft && loaded.status === 'ready' && !asking ? (
            <View className="gap-5">
              <FlagPicker profile={draft} onChange={(p) => { setDraft(p); setSaved(false); }} />
              {saved ? <Caption className="text-ink-muted">{C.editor.saved}</Caption> : null}
              {saveFailed ? <Body accessibilityRole="alert">{C.saveFailed}</Body> : null}
              <PrimaryButton label={C.editor.save} onPress={save} />
              {withdrawFailed ? <Body accessibilityRole="alert">{C.editor.withdrawFailed}</Body> : null}
              {consentedBefore ? (
                <PrimaryButton label={C.editor.withdraw} variant="ghost" onPress={withdraw} />
              ) : null}
            </View>
          ) : null}
          {asking && draft && saveFailed ? <Body accessibilityRole="alert">{C.saveFailed}</Body> : null}
          {asking && draft ? (
            <HealthDataConsent
              userId={userId}
              onConsented={() => void persist(draft)}
              onDecline={() => setAsking(false)}
              onOpenPolicy={onOpenPolicy}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
