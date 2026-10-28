import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScanHistoryDetailScreen } from '../../src/features/shade-history/ScanHistoryDetailScreen';
import { fetchScanHistory } from '../../src/lib/scans';

export default function ScanHistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const onBack = (): void => (router.canGoBack() ? router.back() : router.replace('/scan-history'));
  return <ScanHistoryDetailScreen scanId={String(id ?? '')} loadHistory={fetchScanHistory} onBack={onBack} />;
}
