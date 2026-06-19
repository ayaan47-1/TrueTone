import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchLatestScan, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';

export default function RoutineRoute() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestScan().then(setScan).finally(() => setLoading(false));
  }, []);

  if (loading) return <View><Text>Loading…</Text></View>;
  if (!scan) return <View><Text>No scan yet — run a scan to see your routine.</Text></View>;
  return (
    <View className="flex-1">
      <RoutineView routine={scan.routine} />
      <Pressable
        accessibilityRole="button"
        className="m-4 bg-violet-600 active:bg-violet-700 rounded-2xl py-4 items-center"
        onPress={() => router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })}
      >
        <Text className="text-white text-base font-semibold">Ask about your routine</Text>
      </Pressable>
    </View>
  );
}
