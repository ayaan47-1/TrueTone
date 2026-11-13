#!/usr/bin/env bash
# scripts/e2e/lib/app-executable.sh
#
# Resolves this app's actual EXECUTABLE name on a given simulator (HAG-231, Toby re-review at
# `00072e0`, "Re-review at 00072e0" HIGH): the predicates in network-allowlist.sh used to search
# processImagePath -- a filesystem path to the running binary -- for the BUNDLE IDENTIFIER
# "com.ayaan47.truetone". A path like ".../TrueTone.app/TrueTone" never contains that string; the
# executable is named after Xcode's PRODUCT_NAME / CFBundleExecutable ("TrueTone"), a different
# value entirely. Hardcoding "TrueTone" would fix today's build but silently break again the
# moment CFBundleExecutable changes, so this reads it off the INSTALLED app on the RESOLVED
# simulator itself, every run -- the same device run-maestro.sh resolved, booted, and built onto
# (the device-pinning discipline from HAG-231 rounds 5/6).
#
# Not run directly; sourced by assert-no-network.sh. See
# scripts/e2e/lib/__tests__/app-executable.test.sh for a stubbed-xcrun/plutil test harness.

# resolve_app_executable_name <device-udid> <bundle-id>
# `xcrun simctl get_app_container <udid> <bundle-id> app` prints the installed .app's path on
# the GIVEN simulator -- not whatever the host's Xcode happens to have on disk elsewhere.
# `plutil -extract CFBundleExecutable raw` then reads the executable name straight out of that
# installed bundle's Info.plist. Prints the name on stdout and returns 0; prints nothing and
# returns 1 if the app isn't installed there or the plist has no CFBundleExecutable -- callers
# must fail loudly on that (see assert-no-network.sh), never fall back to a hardcoded guess.
resolve_app_executable_name() {
  local device_udid="$1" bundle_id="$2"
  local app_path
  app_path="$(xcrun simctl get_app_container "$device_udid" "$bundle_id" app 2>/dev/null)" || return 1
  [ -n "$app_path" ] || return 1
  local executable_name
  executable_name="$(plutil -extract CFBundleExecutable raw "$app_path/Info.plist" 2>/dev/null)" || return 1
  [ -n "$executable_name" ] || return 1
  printf '%s\n' "$executable_name"
}
