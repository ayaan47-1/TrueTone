import * as Localization from 'expo-localization';

// Coarse, no precise location. Returns null when undeterminable (caller fails closed).
export function isUSRegion(): boolean | null {
  const region = Localization.getLocales?.()[0]?.regionCode ?? null;
  if (region == null) return null;
  return region === 'US';
}
