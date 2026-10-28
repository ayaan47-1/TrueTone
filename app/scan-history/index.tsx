import { useRouter } from 'expo-router';
import { ScanHistoryScreen } from '../../src/features/shade-history/ScanHistoryScreen';
import { clearShadeHistory, fetchScanHistory } from '../../src/lib/scans';

export default function ScanHistoryRoute() {
  const router = useRouter();
  const onBack = (): void => (router.canGoBack() ? router.back() : router.replace('/you'));
  return (
    <ScanHistoryScreen
      loadHistory={fetchScanHistory}
      clearHistory={clearShadeHistory}
      onBack={onBack}
      onOpen={(scanId) => router.push(`/scan-history/${scanId}`)}
    />
  );
}
