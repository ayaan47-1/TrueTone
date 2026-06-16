import '../global.css';
import { Stack, Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { ProfileProvider, useProfile } from '../src/lib/profile-context';

function Guard() {
  const { loading, error, route } = useProfile();
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
  if (route === 'region-blocked') return <Redirect href="/region-blocked" />;
  if (route === 'age-gate') return <Redirect href="/age-gate" />;
  if (route === 'consent') return <Redirect href="/consent" />;
  return <Stack screenOptions={{ headerShown: true }} />;
}
export default function RootLayout() {
  return (
    <ProfileProvider>
      <Guard />
    </ProfileProvider>
  );
}
