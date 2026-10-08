import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('checks AI and current biometric consent before constructing the Anthropic client', () => {
  const source = readFileSync(join(process.cwd(), 'supabase/functions/routine-chat/index.ts'), 'utf8');
  const consentGuard = source.indexOf('routineChatConsentFailure({');
  const profileCheck = source.indexOf(".select('ai_consent_active')", consentGuard);
  const currentConsentCheck = source.indexOf(".rpc('has_current_scan_consent')", consentGuard);
  const vendorClient = source.indexOf('new Anthropic(');

  expect(consentGuard).toBeGreaterThan(-1);
  expect(profileCheck).toBeGreaterThan(-1);
  expect(currentConsentCheck).toBeGreaterThan(profileCheck);
  expect(vendorClient).toBeGreaterThan(currentConsentCheck);
});
