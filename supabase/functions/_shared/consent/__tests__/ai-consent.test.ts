import { hasActiveAiConsent, routineChatConsentFailure } from '../ai-consent';

test('allows Anthropic only for an explicit active AI consent state', () => {
  expect(hasActiveAiConsent({ ai_consent_active: true })).toBe(true);
  expect(hasActiveAiConsent({ ai_consent_active: false })).toBe(false);
  expect(hasActiveAiConsent(null)).toBe(false);
});

test('a stale biometric receipt returns 403 before the Anthropic path can run', async () => {
  const callAnthropic = jest.fn();
  const failure = await routineChatConsentFailure({
    loadAiConsent: async () => ({ data: { ai_consent_active: true }, error: null }),
    hasCurrentScanConsent: async () => ({ data: false, error: null }),
  });

  if (!failure) callAnthropic();

  expect(failure?.status).toBe(403);
  expect(callAnthropic).not.toHaveBeenCalled();
});

test('routine chat proceeds only when both consent checks succeed', async () => {
  const failure = await routineChatConsentFailure({
    loadAiConsent: async () => ({ data: { ai_consent_active: true }, error: null }),
    hasCurrentScanConsent: async () => ({ data: true, error: null }),
  });

  expect(failure).toBeNull();
});

test('a current-consent RPC error fails closed with 403', async () => {
  const failure = await routineChatConsentFailure({
    loadAiConsent: async () => ({ data: { ai_consent_active: true }, error: null }),
    hasCurrentScanConsent: async () => ({ data: null, error: new Error('unavailable') }),
  });

  expect(failure?.status).toBe(403);
});
