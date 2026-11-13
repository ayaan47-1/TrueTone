#!/usr/bin/env bash
# Integration regression test for HAG-231 round 5 (Toby's folded-in MEDIUM, review-toby.md
# "Re-review" section): run-maestro.sh resolves an exact simulator UDID, but build-variant.sh
# used to call `expo run:ios --device "$SIMULATOR"` (NAME only) and the Maestro invocations used
# the name or nothing at all -- with two same-named simulators booted under different runtimes,
# Expo's own device resolver (findDeviceFromSearchValue in @expo/cli, matches name OR udid) picks
# whichever one it finds first, and Maestro has no device pinning at all. That means the exact
# simulator run-maestro.sh resolved and booted is not necessarily the one Expo installs onto or
# Maestro drives.
#
# This stubs out `npx`/`maestro`/`xcrun`/`log`/`open` with fake executables that record their
# argv instead of touching a real Simulator, and proves the resolved UDID actually reaches both
# command lines -- not just that the scripts have a $SIMULATOR_UDID variable in scope.
#
# Run directly: bash scripts/e2e/__tests__/device-pinning.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FAKE_UDID="ABCD1234-5678-90EF-ABCD-1234567890EF"

PASS=0
FAIL=0

assert_contains() {
  local label="$1" needle="$2" haystack_file="$3"
  if [ -f "$haystack_file" ] && grep -qF -- "$needle" "$haystack_file"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected to find [$needle] in $haystack_file, got:" >&2
    cat "$haystack_file" >&2 2>/dev/null || echo "  (file missing)" >&2
  fi
}

assert_not_contains() {
  local label="$1" needle="$2" haystack_file="$3"
  if [ -f "$haystack_file" ] && grep -qF -- "$needle" "$haystack_file"; then
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — did NOT expect to find [$needle] in $haystack_file, got:" >&2
    cat "$haystack_file" >&2
  else
    PASS=$((PASS + 1))
  fi
}

TMP_ROOT="$(mktemp -d)"
FAKE_BIN="$TMP_ROOT/bin"
mkdir -p "$FAKE_BIN"
trap 'rm -rf "$TMP_ROOT"' EXIT

NPX_CALLS="$TMP_ROOT/npx-calls.log"
MAESTRO_CALLS="$TMP_ROOT/maestro-calls.log"

cat > "$FAKE_BIN/npx" <<'FAKE_NPX'
#!/usr/bin/env bash
echo "$@" >> "$NPX_CALLS_LOG"
exit 0
FAKE_NPX
chmod +x "$FAKE_BIN/npx"

cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO'
#!/usr/bin/env bash
echo "$@" >> "$MAESTRO_CALLS_LOG"
exit 0
FAKE_MAESTRO
chmod +x "$FAKE_BIN/maestro"

cat > "$FAKE_BIN/open" <<'FAKE_OPEN'
#!/usr/bin/env bash
exit 0
FAKE_OPEN
chmod +x "$FAKE_BIN/open"

cat > "$FAKE_BIN/log" <<'FAKE_LOG'
#!/usr/bin/env bash
# Mimics `log stream`: stays alive (backgrounded by the caller) until killed, prints nothing.
sleep 60
FAKE_LOG
chmod +x "$FAKE_BIN/log"

# HAG-231 round 7 (Toby re-review at 00072e0): assert-no-network.sh now resolves the installed
# app's executable name via `simctl get_app_container` + `plutil`, then spawns its log capture
# ON the resolved simulator via `simctl spawn <udid> log stream ...` -- forward that spawn call
# straight to this file's `log` stub (after stripping "simctl spawn <udid>") so Test 2/3 below
# exercise exactly the same healthy-capture behavior as before, just through the new call shape.
# Defined up front (not just before Test 3, as in earlier rounds) since Test 2 now needs it too.
cat > "$FAKE_BIN/xcrun" <<FAKE_XCRUN_EARLY
#!/usr/bin/env bash
if [ "\$1" = "simctl" ] && [ "\$2" = "list" ]; then
  echo "-- iOS 26.4 --"
  echo "    iPhone 17 ($FAKE_UDID) (Shutdown)"
  exit 0
fi
if [ "\$1" = "simctl" ] && [ "\$2" = "get_app_container" ]; then
  echo "/fake/Containers/Bundle/Application/fake-uuid/TrueTone.app"
  exit 0
fi
if [ "\$1" = "simctl" ] && [ "\$2" = "spawn" ]; then
  shift 3
  exec "\$@"
fi
exit 0
FAKE_XCRUN_EARLY
chmod +x "$FAKE_BIN/xcrun"

cat > "$FAKE_BIN/plutil" <<'FAKE_PLUTIL_EARLY'
#!/usr/bin/env bash
echo "TrueTone"
exit 0
FAKE_PLUTIL_EARLY
chmod +x "$FAKE_BIN/plutil"

# -----------------------------------------------------------------------------------------------
# Test 1: build-variant.sh, given a resolved UDID, must pass the UDID (not the name) to
# `expo run:ios --device`.
#
# Before the fix, build-variant.sh had no third (UDID) argument at all and unconditionally ran
# `npx expo run:ios --device "$SIMULATOR"` -- with this same fake npx stub, that would have
# captured "run:ios --device iPhone 17", never the UDID, so this assertion would have failed.
# -----------------------------------------------------------------------------------------------
rm -f "$NPX_CALLS"
NPX_CALLS_LOG="$NPX_CALLS" PATH="$FAKE_BIN:$PATH" \
  EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN="fake.example" \
  EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="fake-token" \
  bash "$ROOT_DIR/scripts/e2e/build-variant.sh" demo "iPhone 17" "$FAKE_UDID" >/dev/null 2>&1

assert_contains "build-variant.sh passes the resolved UDID to expo run:ios --device" \
  "--device $FAKE_UDID" "$NPX_CALLS"
assert_not_contains "build-variant.sh does NOT fall back to the bare device name when a UDID is given" \
  "--device iPhone 17" "$NPX_CALLS"

# -----------------------------------------------------------------------------------------------
# Test 2: assert-no-network.sh, given a device UDID, must pass it to `maestro test --device`.
#
# Before the fix, assert-no-network.sh took no device argument at all and ran plain
# `maestro test "${FLOW_PATHS[@]}"` with no --device flag whatsoever, so this assertion would
# have failed (no "--device" token in the captured argv at all).
# -----------------------------------------------------------------------------------------------
FLOW_FILE="$TMP_ROOT/fake_flow.yaml"
printf 'appId: com.ayaan47.truetone\n---\n- launchApp\n' > "$FLOW_FILE"

rm -f "$MAESTRO_CALLS"
MAESTRO_CALLS_LOG="$MAESTRO_CALLS" PATH="$FAKE_BIN:$PATH" \
  bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1

assert_contains "assert-no-network.sh passes the device UDID to maestro test --device" \
  "--device $FAKE_UDID" "$MAESTRO_CALLS"

# -----------------------------------------------------------------------------------------------
# Test 3: run-maestro.sh's own direct `maestro test` call (the branch used for a variant with no
# network-silence flow, e.g. "demo") must also pin --device to the resolved UDID, not the name.
# This variant never reaches assert-no-network.sh, so re-scoping xcrun down to just `simctl list`
# here is fine -- it's the same resolve-the-simulator stub run-maestro.sh itself needs.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/xcrun" <<FAKE_XCRUN
#!/usr/bin/env bash
if [ "\$1" = "simctl" ] && [ "\$2" = "list" ]; then
  echo "-- iOS 26.4 --"
  echo "    iPhone 17 ($FAKE_UDID) (Shutdown)"
  exit 0
fi
exit 0
FAKE_XCRUN
chmod +x "$FAKE_BIN/xcrun"

rm -f "$MAESTRO_CALLS"
MAESTRO_CALLS_LOG="$MAESTRO_CALLS" PATH="$FAKE_BIN:$PATH" \
  bash "$ROOT_DIR/scripts/e2e/run-maestro.sh" demo "iPhone 17" "iOS 26.4" --skip-build >/dev/null 2>&1

assert_contains "run-maestro.sh's own maestro test call pins --device to the resolved UDID" \
  "--device $FAKE_UDID" "$MAESTRO_CALLS"

echo ""
echo "device-pinning.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
