#!/usr/bin/env bash
# RED-first shell test for scripts/e2e/lib/app-executable.sh (HAG-231 round 7, Toby re-review at
# `00072e0`: assert-no-network.sh's predicates searched processImagePath for the BUNDLE
# IDENTIFIER "com.ayaan47.truetone", but the executable on disk is named "TrueTone"
# (CFBundleExecutable) -- a path like ".../TrueTone.app/TrueTone" never contains the bundle id,
# so the predicate matched zero real app lines on a device). This proves
# resolve_app_executable_name reads the EXECUTABLE NAME from the installed app's own Info.plist
# on the RESOLVED SIMULATOR, via a stubbed `xcrun simctl get_app_container` +
# `plutil -extract CFBundleExecutable raw` -- no real simulator, Xcode build, or plist touched.
#
# Run directly: bash scripts/e2e/lib/__tests__/app-executable.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../app-executable.sh
source "$ROOT_DIR/scripts/e2e/lib/app-executable.sh"

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

FAKE_UDID="ABCD1234-5678-90EF-ABCD-1234567890EF"
BUNDLE_ID="com.ayaan47.truetone"

TMP_ROOT="$(mktemp -d)"
FAKE_BIN="$TMP_ROOT/bin"
mkdir -p "$FAKE_BIN"
trap 'rm -rf "$TMP_ROOT"' EXIT

GET_APP_CONTAINER_CALLS="$TMP_ROOT/get-app-container-calls.log"

# -----------------------------------------------------------------------------------------------
# Test 1 (happy path): `simctl get_app_container` resolves a path on the GIVEN udid/bundle, and
# `plutil -extract CFBundleExecutable raw` on that path's Info.plist resolves "TrueTone". Proves
# the function reads the name from the installed app, not a hardcoded guess.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/xcrun" <<FAKE_XCRUN_OK
#!/usr/bin/env bash
echo "\$@" >> "$GET_APP_CONTAINER_CALLS"
if [ "\$1" = "simctl" ] && [ "\$2" = "get_app_container" ]; then
  echo "/fake/Containers/Bundle/Application/fake-uuid/TrueTone.app"
  exit 0
fi
exit 1
FAKE_XCRUN_OK
chmod +x "$FAKE_BIN/xcrun"

cat > "$FAKE_BIN/plutil" <<'FAKE_PLUTIL_OK'
#!/usr/bin/env bash
# -extract CFBundleExecutable raw <path>
echo "TrueTone"
exit 0
FAKE_PLUTIL_OK
chmod +x "$FAKE_BIN/plutil"

rm -f "$GET_APP_CONTAINER_CALLS"
RESULT_1="$(PATH="$FAKE_BIN:$PATH" resolve_app_executable_name "$FAKE_UDID" "$BUNDLE_ID")"
STATUS_1=$?

assert_eq "resolve_app_executable_name reads CFBundleExecutable off the installed app" "TrueTone" "$RESULT_1"
assert_status "resolve_app_executable_name exits 0 on success" 0 "$STATUS_1"

if [ -f "$GET_APP_CONTAINER_CALLS" ] && grep -qF "simctl get_app_container $FAKE_UDID $BUNDLE_ID app" "$GET_APP_CONTAINER_CALLS"; then
  PASS=$((PASS + 1))
else
  FAIL=$((FAIL + 1))
  echo "FAIL: resolve_app_executable_name must call 'xcrun simctl get_app_container <udid> <bundle-id> app' on the RESOLVED simulator, got:" >&2
  cat "$GET_APP_CONTAINER_CALLS" >&2 2>/dev/null || echo "  (no calls recorded)" >&2
fi

# -----------------------------------------------------------------------------------------------
# Test 2: the app isn't installed on this simulator (get_app_container fails) -- must fail
# loudly (nonzero exit, nothing printed), never fall back to a guessed name.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/xcrun" <<'FAKE_XCRUN_NOT_INSTALLED'
#!/usr/bin/env bash
echo "No such app installed" >&2
exit 2
FAKE_XCRUN_NOT_INSTALLED
chmod +x "$FAKE_BIN/xcrun"

set +e
RESULT_2="$(PATH="$FAKE_BIN:$PATH" resolve_app_executable_name "$FAKE_UDID" "$BUNDLE_ID" 2>/dev/null)"
STATUS_2=$?
set -e

assert_eq "resolve_app_executable_name prints nothing when the app isn't installed" "" "$RESULT_2"
assert_status "resolve_app_executable_name fails loudly when the app isn't installed" 1 "$STATUS_2"

# -----------------------------------------------------------------------------------------------
# Test 3: the app container resolves but its Info.plist has no CFBundleExecutable -- must also
# fail loudly rather than print an empty/garbage name.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/xcrun" <<'FAKE_XCRUN_OK2'
#!/usr/bin/env bash
if [ "$1" = "simctl" ] && [ "$2" = "get_app_container" ]; then
  echo "/fake/TrueTone.app"
  exit 0
fi
exit 1
FAKE_XCRUN_OK2
chmod +x "$FAKE_BIN/xcrun"

cat > "$FAKE_BIN/plutil" <<'FAKE_PLUTIL_MISSING_KEY'
#!/usr/bin/env bash
echo "No value at that key path. (-1)" >&2
exit 1
FAKE_PLUTIL_MISSING_KEY
chmod +x "$FAKE_BIN/plutil"

set +e
RESULT_3="$(PATH="$FAKE_BIN:$PATH" resolve_app_executable_name "$FAKE_UDID" "$BUNDLE_ID" 2>/dev/null)"
STATUS_3=$?
set -e

assert_eq "resolve_app_executable_name prints nothing when CFBundleExecutable is missing" "" "$RESULT_3"
assert_status "resolve_app_executable_name fails loudly when CFBundleExecutable is missing" 1 "$STATUS_3"

echo ""
echo "app-executable.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
