// src/features/shade/use-scan-share.ts
// Task 10: captures the off-screen ScanShareCard to a temporary PNG and hands it to the
// native OS share sheet. Only the rendered card (derived shade descriptors + branding)
// crosses this boundary -- never the source photo, a photo URI, or raw scores
// (CLAUDE.md §3). Unavailable/cancel/failure all resolve without throwing so the result
// screen never crashes on a share attempt.
import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { SCAN_SHARE_CARD_WIDTH, SCAN_SHARE_CARD_HEIGHT } from './ScanShareCard';

export type ScanShareStatus = 'idle' | 'sharing' | 'unavailable' | 'error';

interface UseScanShareResult {
  /** Attach to the off-screen View wrapping <ScanShareCard />. */
  shareCardRef: React.RefObject<View | null>;
  /** Captures the card and opens the native share sheet for the resulting image file. */
  share: () => Promise<void>;
  status: ScanShareStatus;
}

export function useScanShare(): UseScanShareResult {
  const shareCardRef = useRef<View>(null);
  const [status, setStatus] = useState<ScanShareStatus>('idle');

  const share = useCallback(async () => {
    setStatus('sharing');
    try {
      if (!shareCardRef.current) {
        setStatus('error');
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus('unavailable');
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: SCAN_SHARE_CARD_WIDTH,
        height: SCAN_SHARE_CARD_HEIGHT,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your TrueTone shade',
      });
      setStatus('idle');
    } catch {
      // Capture failure, share-sheet failure, or a user cancel all land here -- never
      // crash the result screen over a share attempt.
      setStatus('error');
    }
  }, []);

  return { shareCardRef, share, status };
}
