// Mirrors spec §8 biometric consent block — PLACEHOLDER pending counsel review.
// MUST satisfy BIPA §15(b) (what/purpose/retention) AND WA MHMDA consent.
export const CONSENT_COPY = {
  title: 'Before we scan your skin',
  what: 'TrueTone captures a photo of your face and measures visible features of your skin (a "biometric identifier" under laws like Illinois’ BIPA).',
  purpose: 'Purpose: to estimate your skin’s appearance and suggest a cosmetic routine.',
  retention:
    'We delete it when its purpose is met or within 3 years of your last use, whichever comes first — and anytime you tap "Delete My Data."',
  checkbox:
    'I have read the Biometric Data Policy and consent to TrueTone collecting and storing my biometric data as described.',
};
