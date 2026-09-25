import * as Application from 'expo-application';

/**
 * Build the low-emphasis version marker shown to testers, e.g. "Version 1.0.0 (2)".
 *
 * Pure: takes the already-read native values so it can be unit-tested without the
 * native module. Returns `null` when there is no version to show (so callers can
 * render nothing rather than a half-empty label).
 *
 * @param version installed binary's version string (iOS CFBundleShortVersionString /
 *   Android versionName), or null when unavailable.
 * @param build installed binary's build number (iOS CFBundleVersion /
 *   Android versionCode), or null when unavailable.
 */
export function formatVersionLabel(
  version: string | null,
  build: string | null,
): string | null {
  if (!version) return null;
  const suffix = build ? ` (${build})` : '';
  return `Version ${version}${suffix}`;
}

/**
 * The version marker for the running install, read from the binary via
 * `expo-application` (Info.plist on iOS, PackageInfo on Android). Returns `null`
 * where the native values are unavailable (e.g. Expo Go), so no marker is shown.
 */
export function nativeVersionLabel(): string | null {
  return formatVersionLabel(
    Application.nativeApplicationVersion,
    Application.nativeBuildVersion,
  );
}
