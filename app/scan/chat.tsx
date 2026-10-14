import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { ChatScreen } from '../../src/features/recommend/ChatScreen';
import { AiConsent } from '../../src/features/consent/AiConsent';
import { supabase } from '../../src/lib/supabase';
import { MistBackground, GlassCard, Body, PrimaryButton } from '../../src/components/ui';

type ConsentState = 'loading' | 'allowed' | 'blocked' | 'failed';

export default function ChatRoute() {
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  const router = useRouter();
  const [consentState, setConsentState] = useState<ConsentState>('loading');

  useEffect(() => {
    let active = true;
    if (!scanId) return () => { active = false; };

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('ai_consent_active')
          .maybeSingle();
        if (!active) return;
        if (error || !data) {
          setConsentState('failed');
          return;
        }
        setConsentState(data.ai_consent_active === true ? 'allowed' : 'blocked');
      } catch {
        if (active) setConsentState('failed');
      }
    })();

    return () => { active = false; };
  }, [scanId]);

  if (!scanId) {
    return <ChatUnavailable message="No scan yet — run a scan to ask about your routine." />;
  }
  if (consentState === 'loading') {
    return <ChatUnavailable message="Checking your AI chat choice…" />;
  }
  if (consentState === 'failed') {
    return (
      <ChatUnavailable message="AI chat is unavailable because your consent choice could not be verified.">
        <PrimaryButton label="Back to routine" onPress={() => router.back()} />
      </ChatUnavailable>
    );
  }
  if (consentState === 'blocked') {
    return (
      <AiConsent
        onAllowed={() => setConsentState('allowed')}
        onNotNow={() => router.back()}
      />
    );
  }
  return <ChatScreen scanId={scanId} />;
}

function ChatUnavailable({ children, message }: { children?: React.ReactNode; message: string }) {
  return (
    <MistBackground>
      <View className="flex-1 items-center justify-center px-8">
        <GlassCard className="px-7 py-8 items-center gap-4" radius={32}>
          <Body className="text-center">{message}</Body>
          {children}
        </GlassCard>
      </View>
    </MistBackground>
  );
}
