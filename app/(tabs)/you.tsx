import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Screen,
  GlassCard,
  ListRow,
  Disclaimer,
  Caption,
  tabBarClearance,
  Rise,
  PrimaryButton,
} from '../../src/components/ui';
import { CameraGlyph, ShopGlyph, TodayGlyph, TrendGlyph } from '../../src/components/ui/tab-icons';
import { TextField } from '../../src/components/ui/TextField';
import { useProfile } from '../../src/lib/profile-context';
import { DEMO_MODE } from '../../src/lib/supabase';
import { fetchScanHistory } from '../../src/lib/scans';
import { palette } from '../../src/theme/tokens';
import { useCommunityProfile } from '../../src/features/identity/use-community-profile';
import { RoutineLogger } from '../../src/features/routine/components/RoutineLogger';
import { useDailyRoutine } from '../../src/features/routine/use-daily-routine';
import { usePersonalization } from '../../src/features/session/personalization';
import { shelfStore } from '../../src/features/shop/shelf-store';
import { HeartGlyph } from '../../src/features/community/community-icons';
import { accountSummary } from '../../src/features/account/account-summary';
import { AccountGroup, AccountHeader, ProfileCard } from '../../src/features/account/AccountParts';
import { nativeVersionLabel } from '../../src/lib/app-version';

const MUTE = palette.inkSoft;
const comingSoon = (title: string) => Alert.alert(title, 'Coming soon — there are no purchases in this build.');

/**
 * Account — the v3 profile + shopping hub (video frames t-15/t-17): header with bell, profile
 * card (avatar, name, handle, shade chip, Edit) with Orders / Saved / Day-streak stats, then
 * the Shopping and Your shade sections. Every earlier account control stays reachable below
 * them: data rights + delete (CLAUDE.md §1), policies, the username editor (behind Edit), the
 * routine logger and the build marker. The route stays `you` to avoid deep-link churn.
 */
export default function YouScreen() {
  const router = useRouter();
  const { userId } = useProfile();
  const { profile, saveUsername, pickAvatar, avatarStatus } = useCommunityProfile(userId);
  const { hasScanned, currentShade } = usePersonalization();
  const { summary: routine } = useDailyRoutine(userId);
  const [editing, setEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanCount, setScanCount] = useState<number | null>(0);
  const [savedCount, setSavedCount] = useState(() => shelfStore.get().length);
  const versionLabel = nativeVersionLabel();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSavedCount(shelfStore.get().length);
      fetchScanHistory()
        .then((scans) => { if (!cancelled) setScanCount(scans.length); })
        .catch(() => { if (!cancelled) setScanCount(null); });
      return () => { cancelled = true; };
    }, []),
  );

  const summary = accountSummary({
    username: profile?.username ?? null,
    savedCount,
    streak: routine.streak,
    scanCount,
    shadeName: hasScanned ? currentShade?.shadeName ?? null : null,
    demo: DEMO_MODE,
  });

  const draft = usernameDraft || profile?.username || '';

  const handleSaveUsername = async () => {
    setSaving(true);
    setUsernameError(null);
    const result = await saveUsername(draft);
    setSaving(false);
    if (!result.ok) {
      setUsernameError(result.error);
      return;
    }
    setUsernameDraft('');
  };

  return (
    <Screen className="px-6" topGap={22} bottomGap={tabBarClearance()}>
      <Rise>
        <AccountHeader onBell={() => Alert.alert('Notifications', 'Coming soon — notifications are not in this build yet.')} />
        <View className="mt-[18px]">
          <ProfileCard
            summary={summary}
            scanned={hasScanned}
            avatarUri={profile?.avatarUri ?? null}
            avatarDisabled={!profile}
            onAvatar={() => { void pickAvatar(); }}
            editing={editing}
            onEdit={() => {
              // Closing the editor discards an unsaved draft + its error.
              if (editing) {
                setUsernameDraft('');
                setUsernameError(null);
              }
              setEditing(!editing);
            }}
          />
        </View>
        {avatarStatus === 'unavailable' && (
          <Caption className="mt-2 text-center text-ink-soft">
            Photo access is off -- enable it in Settings to add a photo.
          </Caption>
        )}
        {avatarStatus === 'error' && (
          <Caption className="mt-2 text-center text-red-600">Couldn&apos;t update your photo. Try again.</Caption>
        )}
        {!hasScanned ? (
          <View className="mt-3.5">
            <PrimaryButton label="Find my shade" onPress={() => router.push('/scan-gate')} />
          </View>
        ) : null}
      </Rise>

      {editing ? (
        <GlassCard flat className="mt-3 px-6 py-4" radius={22}>
          <TextField
            testID="username-input"
            label={profile ? 'Username' : 'Choose a username'}
            value={draft}
            onChangeText={(t) => {
              setUsernameDraft(t);
              setUsernameError(null);
            }}
            placeholder="yourname"
            autoCapitalize="none"
            error={usernameError ?? undefined}
          />
          <View className="mt-3">
            <PrimaryButton
              testID="username-save"
              label={profile ? 'Save username' : 'Create username'}
              variant="glass"
              disabled={saving || draft.trim().length === 0}
              onPress={() => {
                void handleSaveUsername();
              }}
            />
          </View>
        </GlassCard>
      ) : null}

      <Rise index={1}>
        <AccountGroup
          title="Shopping"
          rows={[
            { label: 'Orders', caption: summary.ordersCaption, icon: <ShopGlyph color={MUTE} size={18} />, onPress: () => comingSoon('Orders') },
            { label: 'Saved items', caption: summary.savedCaption, icon: <HeartGlyph color={MUTE} size={15} filled />, onPress: () => router.push('/shop') },
            { label: 'Addresses & payment', icon: <TodayGlyph color={MUTE} size={18} />, onPress: () => comingSoon('Addresses & payment') },
          ]}
        />
      </Rise>

      <Rise index={2}>
        <AccountGroup
          title="Your shade"
          rows={[
            { label: 'Shade & preferences', caption: 'Coverage, finish, things you skip', icon: <CameraGlyph color={MUTE} size={18} />, onPress: () => router.push('/setup/goals') },
            { label: 'Seasonal report', caption: summary.seasonalCaption, icon: <TrendGlyph color={MUTE} size={16} />, onPress: () => router.push('/scan-gate') },
          ]}
        />
      </Rise>

      <Rise index={3}>
        <AccountGroup
          title="Privacy"
          rows={[
            { label: 'Your Data', onPress: () => router.push('/data') },
            { label: 'Privacy & Policies', onPress: () => router.push('/policies') },
            { label: 'Delete everything', destructive: true, onPress: () => router.push('/data') },
          ]}
        />
      </Rise>

      <Rise index={4}>
        <View className="mt-6">
          <RoutineLogger userId={userId} profile={profile} />
        </View>
      </Rise>

      {/* Dev-only entry to the region overlay (app/(dev)/bbox-overlay.tsx). Reaching that screen
          otherwise needs an adb deep link, which is unavailable whenever USB is not cooperating —
          it cost most of a device session on 2026-07-26. Stripped from any release build by the
          __DEV__ guard. */}
      {__DEV__ && (
        <Rise index={5}>
          <GlassCard flat className="px-6 py-1 mt-3" radius={22}>
            <ListRow label="DEV · Region overlay" onPress={() => router.push('/bbox-overlay')} />
          </GlassCard>
        </Rise>
      )}

      <Rise index={6}>
        <View className="mt-7"><Disclaimer /></View>
      </Rise>

      {/* Low-emphasis build marker so testers can name the installed version + native
          build number. Values come from the binary via expo-application (see
          src/lib/app-version.ts); renders nothing when unavailable (e.g. Expo Go). */}
      {versionLabel ? (
        <Rise index={7}>
          <Caption className="mt-4 text-center text-[11px] text-ink-muted">{versionLabel}</Caption>
        </Rise>
      ) : null}
    </Screen>
  );
}
