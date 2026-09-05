import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ProfileProvider, useProfile } from '../src/lib/profile-context';
import type { Route } from '../src/lib/routing-guard';
import { DEMO_MODE } from '../src/lib/supabase';
import { MistBackground, GlassCard, Heading, Body } from '../src/components/ui';
import { palette } from '../src/theme/tokens';

// The demo build stubs an already-onboarded identity (profile-context.tsx) and skips the
// gate chain entirely, so a live camera at this path would have no age-gate/consent in
// front of it -- structural BIPA exposure if anyone ever ships EXPO_PUBLIC_DEMO=1 with a
// real camera build. Block it here, not inside Capture.tsx: this is the one place that
// already redirects imperatively per pathname for every other sensitive screen.
const DEMO_BLOCKED_PATH = '/scan';

// Map a gate Route to the screen path that must be shown for it. `home` means "no gate".
const GATE_PATH: Partial<Record<Route, string>> = {
  'region-blocked': '/region-blocked',
  'age-gate': '/age-gate',
  consent: '/consent',
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <MistBackground>
      <View className="flex-1 items-center justify-center px-8">
        <GlassCard className="px-7 py-8 items-center" radius={32}>
          {children}
        </GlassCard>
      </View>
    </MistBackground>
  );
}

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
    if (DEMO_MODE && pathname === DEMO_BLOCKED_PATH) {
      // Demo mode always resolves to a cleared-gates 'home' route (profile-context.tsx), so
      // the gate check below would never catch this -- checked first and unconditionally.
      router.replace('/');
      return;
    }
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
      <Centered>
        <Body className="text-center">Warming up your mirror…</Body>
      </Centered>
    );
  if (error)
    return (
      <Centered>
        <Heading className="mb-2 text-center">Can’t connect</Heading>
        <Body className="text-center">There’s a connection problem. Pull to retry.</Body>
      </Centered>
    );
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: '',
          headerTintColor: palette.mauve600,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="policies/[doc]"
          options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Seed metrics so children render synchronously (real values in-app; a zeroed
  // fallback under Jest, where no layout pass ever fires).
  const metrics =
    initialWindowMetrics ?? {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    };

  return (
    <SafeAreaProvider initialMetrics={metrics}>
      {fontsLoaded ? (
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
        >
          <ProfileProvider>
            <Guard />
          </ProfileProvider>
        </StripeProvider>
      ) : (
        <MistBackground />
      )}
    </SafeAreaProvider>
  );
}
