import { useContext } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const ZERO: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Safe-area insets that degrade to zero when no `SafeAreaProvider` is mounted
 * (e.g. inside unit tests) instead of throwing like `useSafeAreaInsets`.
 */
export function useInsets(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? ZERO;
}
