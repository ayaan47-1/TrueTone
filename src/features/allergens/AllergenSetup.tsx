// src/features/allergens/AllergenSetup.tsx
// Setup's optional allergen step (design WS-A, P1). No / Skip store only the answer (a UX flag,
// not health data) and write no receipt. Yes → pick flags → the wa_health consent sheet BEFORE
// anything is saved. Declining saves no flags and returns here with the answer 'skipped'.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Screen, HEADER_CLEARANCE, Eyebrow, Heading, Body, Caption, PrimaryButton } from '../../components/ui';
import { ALLERGEN_COPY as C } from '../../content/allergen-copy';
import { saveAllergenProfile } from './allergen-store';
import { emptyProfile, flaggedCount, type AllergenAnswer, type AllergenProfile } from './profile';
import { FlagPicker } from './FlagPicker';
import { HealthDataConsent } from './HealthDataConsent';

type Props = { userId: string | null; onDone: () => void; onOpenPolicy?: () => void };
type Step = 'ask' | 'pick' | 'consent';

const now = () => new Date().toISOString();

export function AllergenSetup({ userId, onDone, onOpenPolicy }: Props) {
  const [step, setStep] = useState<Step>('ask');
  const [draft, setDraft] = useState<AllergenProfile>(() => emptyProfile('yes', now()));
  const [saveFailed, setSaveFailed] = useState(false);

  async function storeAnswerOnly(answer: Exclude<AllergenAnswer, 'yes'>) {
    // Best effort: the answer only hides this step next time. Never block Setup on it.
    if (userId) await saveAllergenProfile(userId, emptyProfile(answer, now())).catch(() => undefined);
  }

  async function answer(a: Exclude<AllergenAnswer, 'yes'>) {
    await storeAnswerOnly(a);
    onDone();
  }

  async function consented() {
    try {
      if (userId) await saveAllergenProfile(userId, { ...draft, answer: 'yes', updatedAt: now() });
    } catch {
      setSaveFailed(true); // stay on the consent step so the user can try again (code review M1)
      return;
    }
    onDone();
  }

  async function declined() {
    await storeAnswerOnly('skipped');
    setDraft(emptyProfile('yes', now()));
    setStep('ask');
  }

  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 gap-6 pt-6 pb-2">
          <View className="gap-3">
            <Eyebrow>Optional</Eyebrow>
            <Heading>{C.setup.title}</Heading>
            <Body className="text-ink-soft">{C.setup.subtitle}</Body>
          </View>

          {step === 'ask' ? (
            <View className="mt-auto gap-3">
              <PrimaryButton label={C.setup.yes} onPress={() => setStep('pick')} />
              <PrimaryButton label={C.setup.no} variant="glass" onPress={() => answer('no')} />
              <PrimaryButton label={C.setup.skip} variant="ghost" onPress={() => answer('skipped')} />
            </View>
          ) : null}

          {step === 'pick' ? (
            <View className="gap-5">
              <FlagPicker profile={draft} onChange={setDraft} />
              <Caption className="text-[11px] leading-[17px] text-ink-muted">{C.disclaimer}</Caption>
              <PrimaryButton
                label={C.setup.save}
                disabled={flaggedCount(draft) === 0}
                accessibilityState={{ disabled: flaggedCount(draft) === 0 }}
                onPress={() => setStep('consent')}
              />
            </View>
          ) : null}

          {step === 'consent' ? (
            <View className="gap-3">
              {saveFailed ? <Body accessibilityRole="alert">{C.saveFailed}</Body> : null}
              <HealthDataConsent onConsented={consented} onDecline={declined} onOpenPolicy={onOpenPolicy} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
