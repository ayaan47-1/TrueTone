#!/usr/bin/env bash
# RED-first shell test for scripts/e2e/lib/simulator-resolve.sh (HAG-231, Toby re-review
# finding 1: "iPhone 17" exists under more than one iOS runtime on the macos-26 runner image, so
# resolving a simulator by device name alone is ambiguous and must fail loudly instead of
# silently picking an arbitrary match). Run directly: bash scripts/e2e/lib/__tests__/simulator-resolve.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../simulator-resolve.sh
source "$ROOT_DIR/scripts/e2e/lib/simulator-resolve.sh"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected '$expected', got '$actual'" >&2
  fi
}

assert_status() {
  local label="$1" expected_status="$2" actual_status="$3"
  if [ "$expected_status" -eq "$actual_status" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected exit $expected_status, got $actual_status" >&2
  fi
}

# Synthetic `xcrun simctl list devices` output: the same device name ("iPhone 17") appears under
# two different runtimes, plus a same-prefix device ("iPhone 17 Pro") in the same section.
DEVICES_OUTPUT='== Devices ==
-- iOS 26.2 --
    iPhone 16e (11111111-1111-1111-1111-111111111111) (Shutdown)
    iPhone 17 (22222222-2222-2222-2222-222222222222) (Shutdown)
    iPhone 17 Pro (33333333-3333-3333-3333-333333333333) (Shutdown)
-- iOS 26.4 --
    iPhone 17 (44444444-4444-4444-4444-444444444444) (Shutdown)
    iPhone 17 Pro (55555555-5555-5555-5555-555555555555) (Booted)
-- tvOS 26.0 --
    Apple TV (66666666-6666-6666-6666-666666666666) (Shutdown)
'

udid="$(resolve_simulator_udid "iPhone 17" "iOS 26.4" "$DEVICES_OUTPUT")"
status=$?
assert_status "exact match: exit 0" 0 "$status"
assert_eq "exact match: resolves to the iOS 26.4 UDID, not iOS 26.2's" \
  "44444444-4444-4444-4444-444444444444" "$udid"

udid="$(resolve_simulator_udid "iPhone 17" "iOS 26.2" "$DEVICES_OUTPUT")"
assert_eq "prefix collision: resolves the exact device, not 'iPhone 17 Pro'" \
  "22222222-2222-2222-2222-222222222222" "$udid"

udid="$(resolve_simulator_udid "iPhone 17" "iOS 99.0" "$DEVICES_OUTPUT")"
status=$?
assert_status "unknown runtime: exit 1" 1 "$status"
assert_eq "unknown runtime: prints nothing" "" "$udid"

udid="$(resolve_simulator_udid "iPhone Nonexistent" "iOS 26.4" "$DEVICES_OUTPUT")"
status=$?
assert_status "unknown device: exit 1" 1 "$status"
assert_eq "unknown device: prints nothing" "" "$udid"

echo ""
echo "simulator-resolve.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
