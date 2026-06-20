import '../global.css';
import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Mulish_400Regular,
  Mulish_500Medium,
  Mulish_600SemiBold,
  Mulish_700Bold,
} from '@expo-google-fonts/mulish';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ProfileProvider, useProfile } from '../src/lib/profile-context';
import { MistBackground, GlassCard, Heading, Body } from '../src/components/ui';
import { palette } from '../src/theme/tokens';

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
  if (route === 'region-blocked') return <Redirect href="/region-blocked" />;
  if (route === 'age-gate') return <Redirect href="/age-gate" />;
  if (route === 'consent') return <Redirect href="/consent" />;
  return (
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="policies/[doc]"
        options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    Mulish_400Regular,
    Mulish_500Medium,
    Mulish_600SemiBold,
    Mulish_700Bold,
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
        <ProfileProvider>
          <Guard />
        </ProfileProvider>
      ) : (
        <MistBackground />
      )}
    </SafeAreaProvider>
  );
}
