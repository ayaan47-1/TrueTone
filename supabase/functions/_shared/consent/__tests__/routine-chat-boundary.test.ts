import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('checks active AI consent before constructing the Anthropic client', () => {
  const source = readFileSync(join(process.cwd(), 'supabase/functions/routine-chat/index.ts'), 'utf8');
  const profileCheck = source.indexOf(".select('ai_consent_active')");
  const consentGuard = source.indexOf('hasActiveAiConsent(aiConsentProfile)');
  const vendorClient = source.indexOf('new Anthropic(');

  expect(profileCheck).toBeGreaterThan(-1);
  expect(consentGuard).toBeGreaterThan(profileCheck);
  expect(vendorClient).toBeGreaterThan(consentGuard);
});
