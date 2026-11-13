import { useEffect } from 'react';
import { AppState } from 'react-native';
import { feedbackCleanup } from './runtime';

export function useFeedbackCleanupLifecycle() {
  useEffect(() => {
    const retry = () => { void feedbackCleanup.retry().catch(() => undefined); };
    retry();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    return () => subscription.remove();
  }, []);
}
