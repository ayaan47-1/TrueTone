export const POLICY_VERSION = '2026-10-06.a1';
export const AI_CONSENT_VERSION = POLICY_VERSION;

export type DocKey = 'privacy' | 'terms' | 'biometric' | 'retention' | 'wa_health';

export const POLICY_DOCS: { key: DocKey; title: string }[] = [
  { key: 'privacy', title: 'Privacy Policy' },
  { key: 'terms', title: 'Terms of Use' },
  { key: 'biometric', title: 'Biometric Data Policy' },
  { key: 'retention', title: 'Data Retention Schedule' },
  { key: 'wa_health', title: 'WA Consumer Health Data Policy' },
];
