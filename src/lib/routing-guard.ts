export type GateState = { isUS: boolean | null; is18: boolean; consent: boolean };
export type Route = 'region-blocked' | 'age-gate' | 'consent' | 'home';

export function nextRoute(s: GateState): Route {
  if (s.isUS !== true) return 'region-blocked'; // fail closed on false OR null
  if (!s.is18) return 'age-gate';
  if (!s.consent) return 'consent';
  return 'home';
}
