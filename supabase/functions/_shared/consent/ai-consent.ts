export type AiConsentProfile = { ai_consent_active?: boolean } | null;

type ConsentQueryResult<T> = { data: T; error: unknown };

export type RoutineChatConsentDeps = {
  loadAiConsent: () => Promise<ConsentQueryResult<AiConsentProfile>>;
  hasCurrentScanConsent: () => Promise<ConsentQueryResult<boolean | null>>;
};

export function hasActiveAiConsent(profile: AiConsentProfile): boolean {
  return profile?.ai_consent_active === true;
}

export async function routineChatConsentFailure(
  deps: RoutineChatConsentDeps,
): Promise<Response | null> {
  const aiConsent = await deps.loadAiConsent();
  if (aiConsent.error || !hasActiveAiConsent(aiConsent.data)) {
    return new Response('AI consent required', { status: 403 });
  }

  const currentScanConsent = await deps.hasCurrentScanConsent();
  if (currentScanConsent.error || currentScanConsent.data !== true) {
    return new Response('AI consent required', { status: 403 });
  }

  return null;
}
