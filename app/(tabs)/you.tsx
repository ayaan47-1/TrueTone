import { useState } from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Display,
  GlassCard,
  ListRow,
  Disclaimer,
  TAB_BAR_CLEARANCE,
  Rise,
  PrimaryButton,
  Caption,
  PressableScale,
} from '../../src/components/ui';
import { TextField } from '../../src/components/ui/TextField';
import { useProfile } from '../../src/lib/profile-context';
import { useCommunityProfile } from '../../src/features/identity/use-community-profile';
import { RoutineLogger } from '../../src/features/routine/components/RoutineLogger';

/**
 * Account — profile & controls. Surfaces the previously-orphaned data-rights and legal
 * screens (both are reachability requirements: data deletion per CLAUDE.md §1, and
 * policies must be reachable before a scan per the build order). The route stays `you`
 * internally to avoid deep-link churn; only the visible title reads "Account".
 *
 * Task 11: adds the CommunityProfile username/avatar identity seam (see
 * src/features/identity). Avatar picking is only offered once a username exists --
 * CommunityProfile has no "username unset" state, so there is nothing to attach a
 * picked avatar to before then.
 */
export default function YouScreen() {
  const router = useRouter();
  const { userId } = useProfile();
  const { profile, saveUsername, pickAvatar, avatarStatus } = useCommunityProfile(userId);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    <Screen className="px-6" topGap={32} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="items-center mt-3 mb-8">
          <PressableScale
            testID="avatar-picker"
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            disabled={!profile}
            onPress={() => {
              void pickAvatar();
            }}
          >
            {profile?.avatarUri ? (
              <Image
                testID="avatar-image"
                source={{ uri: profile.avatarUri }}
                className="h-20 w-20 rounded-full mb-4"
              />
            ) : (
              <View className="h-20 w-20 rounded-full bg-mist-300 mb-4" />
            )}
          </PressableScale>
          <Display className="text-[28px]">Account</Display>
          {avatarStatus === 'unavailable' && (
            <Caption className="mt-1 text-ink-soft">
              Photo access is off -- enable it in Settings to add a photo.
            </Caption>
          )}
          {avatarStatus === 'error' && (
            <Caption className="mt-1 text-red-600">Couldn&apos;t update your photo. Try again.</Caption>
          )}
        </View>
      </Rise>

      <Rise index={1}>
        <GlassCard flat className="px-6 py-4 mb-3" radius={22}>
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
      </Rise>

      <Rise index={2}>
        <View className="mb-3">
          <RoutineLogger userId={userId} profile={profile} />
        </View>
      </Rise>

      <View className="gap-3">
      <Rise index={2}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow
          label="Your Data"
          onPress={() => router.push('/data')}
        />
      </GlassCard>
      </Rise>
      <Rise index={3}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow
          label="Privacy & Policies"
          onPress={() => router.push('/policies')}
        />
      </GlassCard>
      </Rise>
      <Rise index={4}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow label="Notifications" onPress={() => {}} />
      </GlassCard>
      </Rise>
      <Rise index={5}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow label="Delete everything" destructive hideChevron onPress={() => router.push('/data')} />
      </GlassCard>
      </Rise>
      </View>

      {/* Dev-only entry to the region overlay (app/(dev)/bbox-overlay.tsx). Reaching that screen
          otherwise needs an adb deep link, which is unavailable whenever USB is not cooperating —
          it cost most of a device session on 2026-07-26. Stripped from any release build by the
          __DEV__ guard. */}
      {__DEV__ && (
        <Rise index={6}>
          <GlassCard flat className="px-6 py-1 mt-3" radius={22}>
            <ListRow label="DEV · Region overlay" onPress={() => router.push('/bbox-overlay')} />
          </GlassCard>
        </Rise>
      )}

      <Rise index={7}>
        <View className="mt-7"><Disclaimer /></View>
      </Rise>
    </Screen>
  );
}
