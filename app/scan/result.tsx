import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Result } from '../../src/features/read/Result';
import { MistBackground, GlassCard, Body, PrimaryButton } from '../../src/components/ui';
import { fetchScanHistory } from '../../src/lib/scans';
import { SKIN_TYPE_FEELS, type SkinTypeFeel } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';
import type { ScoreSnapshot } from '../../src/features/age/age-types';
import { RoutineFeedbackPrompt } from '../../src/features/feedback/RoutineFeedbackPrompt';
import { computePersonalBaseline } from '../../src/features/personalize/personal-baseline';
import { computePersonalDeviation } from '../../src/features/personalize/personal-deviation';
import { personalCopy } from '../../src/features/personalize/personal-copy';
import { usePersonalization } from '../../src/features/session/personalization';
import { ShadeMatchResult } from '../../src/features/shade/ShadeMatchResult';

type Status = 'loading' | 'ready' | 'empty' | 'error';

// The DB check-constrains skin_type_feel to the four values; narrow defensively.
function toSkinTypeFeel(value: string): SkinTypeFeel {
  return (SKIN_TYPE_FEELS as readonly string[]).includes(value)
    ? (value as SkinTypeFeel)
    : 'combination';
}

export default function ResultRoute() {
  const router = useRouter();
  // Live camera shade-match: the shade is derived from the FRESH in-memory read at capture
  // time (ReadResult.tone does not survive the DB round-trip) and published to the session
  // via personalization.setScan(). When a currentShade exists, this screen becomes the makeup
  // shade result (shade name + product picks) instead of the skin-read analysis. Descriptors
  // only -- never the image (CLAUDE.md §3).
  const { currentShade } = usePersonalization();

  const [status, setStatus] = useState<Status>('loading');
  const [scores, setScores] = useState<ScoreVector | null>(null);
  const [prev, setPrev] = useState<ScoreVector | null>(null);
  const [skinType, setSkinType] = useState<SkinTypeFeel>('combination');
  const [trendHistory, setTrendHistory] = useState<ScoreSnapshot[]>([]);
  const [skinAge, setSkinAge] = useState<number | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [needsFeedback, setNeedsFeedback] = useState(false);
  const [personalMessages, setPersonalMessages] = useState<string[]>([]);

  useEffect(() => {
    if (currentShade) return; // shade-match path owns the screen; skip the skin-read fetch
    let active = true; // guard against setState after unmount / fast navigation
    void (async () => {
      try {
        const history = await fetchScanHistory(10); // trend + enough priors for personalization
        const latest = history[0];
        if (!active) return;
        if (!latest) {
          setStatus('empty');
          return;
        }
        setScores(latest.scores);
        setSkinType(toSkinTypeFeel(latest.skinType));
        setPrev(history[1]?.scores ?? null);
        // Build ScoreSnapshot[] (newest-first) for the age/trend card. Capped at the
        // pre-personalization window of 5 so the trend baseline semantics are unchanged
        // (the wider fetch exists only to feed the personal baseline below).
        setTrendHistory(history.slice(0, 5).map((s) => ({ capturedAt: s.capturedAt, scores: s.scores })));
        setSkinAge(latest.skinAge ?? null);
        // Personalization: relative to the user's own prior scans (spec §4.1).
        // Cold start (baseline null) → no messages → today's UI exactly.
        const baseline = computePersonalBaseline(
          history.map((s) => ({ scores: s.scores, isStub: s.isStub, captureQuality: s.captureQuality })),
        );
        setPersonalMessages(
          baseline ? personalCopy(computePersonalDeviation(latest.scores, baseline)) : [],
        );
        // "Did this help?" shows once a prior scan exists and the latest has no feedback yet.
        setLatestId(latest.id);
        setNeedsFeedback(history.length > 1 && latest.routineHelpful === null);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [currentShade]);

  // Live camera shade-match result: shade name + product picks. Rendered as soon as a
  // shade exists, so the skin-read states below never flash on the camera-demo path.
  if (currentShade) {
    return (
      <ShadeMatchResult
        shade={currentShade}
        onSeeLook={() => router.replace('/')}
        onShare={() => {}}
      />
    );
  }

  if (status === 'loading') {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center" radius={32}>
            <Body className="text-center">Preparing your read…</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  if (status === 'error') {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center gap-5" radius={32}>
            <Body className="text-center">Couldn&apos;t load your read. Please try again.</Body>
            <PrimaryButton label="Back to Home" fullWidth onPress={() => router.replace('/')} />
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  if (status === 'empty' || !scores) {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center gap-5" radius={32}>
            <Body className="text-center">No scan yet. Your skin reads will show up here.</Body>
            <PrimaryButton label="Back to Home" fullWidth onPress={() => router.replace('/')} />
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  return (
    <Result
      scores={scores}
      skinType={skinType}
      prev={prev}
      history={trendHistory}
      skinAge={skinAge}
      personalMessages={personalMessages}
      footer={
        <>
          {needsFeedback && latestId && (
            <RoutineFeedbackPrompt scanId={latestId} onDone={() => setNeedsFeedback(false)} />
          )}
          <PrimaryButton label="Scan again" fullWidth onPress={() => router.push('/scan')} />
        </>
      }
    />
  );
}
