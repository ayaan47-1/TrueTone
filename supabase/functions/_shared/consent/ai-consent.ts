export type AiConsentProfile = { ai_consent_active?: boolean } | null;

export function hasActiveAiConsent(profile: AiConsentProfile): boolean {
  return profile?.ai_consent_active === true;
}
