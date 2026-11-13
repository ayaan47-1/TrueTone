#!/usr/bin/env bash
# scripts/e2e/lib/simulator-resolve.sh
#
# Resolves a Simulator's UDID from an EXACT device name AND an EXACT runtime name together,
# instead of matching device name alone across every installed runtime (HAG-231, Toby
# re-review finding 1): on the macos-26 runner image "iPhone 17" exists under iOS 26.2, 26.4,
# and 26.5 simultaneously, and `xcrun simctl list devices | grep "iPhone 17" | head -1` (the old
# approach) silently resolves to whichever one `grep` happens to see first - not necessarily the
# runtime the pinned Xcode actually ships. Also guards against the device-name-prefix trap
# ("iPhone 17" is a substring of "iPhone 17 Pro").
#
# Not run directly; sourced by run-maestro.sh. See
# scripts/e2e/lib/__tests__/simulator-resolve.test.sh for a test harness that feeds this
# synthetic `xcrun simctl list devices` output instead of a real simulator.

# resolve_simulator_udid <device-name> <runtime-name> <simctl-devices-output>
# Prints the UDID on stdout and returns 0 if found. Prints nothing and returns 1 if the
# runtime section or the device within it does not exist - callers must fail loudly on that,
# not fall back to an unrelated match.
resolve_simulator_udid() {
  local device_name="$1" runtime_name="$2" devices_output="$3"
  local section_header="-- ${runtime_name} --"
  # Escape regex metacharacters in the device name so it is matched literally.
  local escaped_name
  escaped_name="$(printf '%s' "$device_name" | sed -E 's/[.[\*^$()+?{|\\]/\\&/g')"
  local udid
  udid="$(
    printf '%s\n' "$devices_output" \
      | awk -v header="$section_header" '
      $0 == header { in_section = 1; next }
      /^-- .* --$/ { in_section = 0 }
      in_section { print }
    ' \
      | grep -E "^[[:space:]]*${escaped_name} \(" \
      | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' \
      | head -1
  )"
  if [ -z "$udid" ]; then
    return 1
  fi
  printf '%s\n' "$udid"
}
