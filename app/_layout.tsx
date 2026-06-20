import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Text, View } from 'react-native';
import { ProfileProvider, useProfile } from '../src/lib/profile-context';
import type { Route } from '../src/lib/routing-guard';

// Map a gate Route to the screen path that must be shown for it. `home` means "no gate".
const GATE_PATH: Partial<Record<Route, string>> = {
  'region-blocked': '/region-blocked',
  'age-gate': '/age-gate',
  consent: '/consent',
};

function Guard() {
  const { loading, error, route } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  // Enforce gates by NAVIGATING, never by rendering <Redirect> instead of <Stack>. Rendering a
  // redirect to a screen that lives inside the (un-rendered) Stack tears the navigator down and
  // back up every frame — which remounts ProfileProvider and loops refresh() forever. Keeping the
  // Stack always mounted and redirecting imperatively avoids that.
  useEffect(() => {
    if (loading || error) return;
    const target = GATE_PATH[route];
    if (target) {
      // A gate is active → make sure we're on its screen.
      if (pathname !== target) router.replace(target);
    } else if ((Object.values(GATE_PATH) as string[]).includes(pathname)) {
      // route === 'home': all gates cleared but we're still sitting on a gate screen → enter the app.
      router.replace('/');
    }
  }, [loading, error, route, pathname, router]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading…</Text>
      </View>
    );
  if (error)
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Connection problem. Pull to retry.</Text>
      </View>
    );
  return <Stack screenOptions={{ headerShown: true }} />;
}

export default function RootLayout() {
  return (
    <ProfileProvider>
      <Guard />
    </ProfileProvider>
  );
}
