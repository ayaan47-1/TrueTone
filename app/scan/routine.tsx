import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { fetchLatestScan, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';

export default function RoutineRoute() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestScan().then(setScan).finally(() => setLoading(false));
  }, []);

  if (loading) return <View><Text>Loading…</Text></View>;
  if (!scan) return <View><Text>No scan yet — run a scan to see your routine.</Text></View>;
  return <RoutineView routine={scan.routine} />;
}
