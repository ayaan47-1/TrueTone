import type { DocKey } from './manifest';

// PLACEHOLDER bodies pending counsel review. biometric MUST keep what/purpose/retention (BIPA §15(b)).
export const POLICY_BODIES: Record<DocKey, string> = {
  privacy: '> PLACEHOLDER — Privacy Policy pending counsel review.',
  terms: '> PLACEHOLDER — Terms pending counsel review.',
  biometric:
    '> PLACEHOLDER — Biometric Data Policy pending counsel review.\n\n' +
    'What we collect: a photo of your face and visible skin features (a biometric identifier).\n' +
    'Purpose: estimate skin appearance and suggest a cosmetic routine.\n' +
    'Retention: deleted when purpose is met or within 3 years of last use, whichever is first.',
  retention: '> PLACEHOLDER — Retention Schedule pending counsel review.',
  wa_health: '> PLACEHOLDER — WA Consumer Health Data Policy pending counsel review.',
};
