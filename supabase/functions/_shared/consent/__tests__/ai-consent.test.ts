import { hasActiveAiConsent } from '../ai-consent';

test('allows Anthropic only for an explicit active AI consent state', () => {
  expect(hasActiveAiConsent({ ai_consent_active: true })).toBe(true);
  expect(hasActiveAiConsent({ ai_consent_active: false })).toBe(false);
  expect(hasActiveAiConsent(null)).toBe(false);
});
