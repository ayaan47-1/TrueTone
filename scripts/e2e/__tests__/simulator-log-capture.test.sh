#!/usr/bin/env bash
# Integration test for HAG-231 round 7 (Toby re-review at `00072e0`, review-toby.md "Re-review at
# 00072e0" HIGH): assert-no-network.sh used to run plain host `log stream` and match
# processImagePath against the BUNDLE IDENTIFIER. Both are wrong: the capture must come from the
# RESOLVED SIMULATOR (`xcrun simctl spawn <udid> log stream ...`), and the predicate must match
# the installed app's actual EXECUTABLE name (CFBundleExecutable via
# scripts/e2e/lib/app-executable.sh), never the bundle id. Stubs xcrun/plutil/maestro so no real
# Simulator, build, or log service is touched.
#
# Run directly: bash scripts/e2e/__tests__/simulator-log-capture.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FAKE_UDID="ABCD1234-5678-90EF-ABCD-1234567890EF"

PASS=0
FAIL=0

assert_exit_code() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected exit $expected, got $actual" >&2
  fi
}

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

FLOW_FILE="$TMP_ROOT/fake_flow.yaml"
printf 'appId: com.ayaan47.truetone\n---\n- launchApp\n' > "$FLOW_FILE"

XCRUN_CALLS="$TMP_ROOT/xcrun-calls.log"

cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO'
#!/usr/bin/env bash
exit 0
FAKE_MAESTRO
chmod +x "$FAKE_BIN/maestro"

cat > "$FAKE_BIN/plutil" <<'FAKE_PLUTIL'
#!/usr/bin/env bash
echo "TrueTone"
exit 0
FAKE_PLUTIL
chmod +x "$FAKE_BIN/plutil"

# -----------------------------------------------------------------------------------------------
# Test 1 (happy path): proves BOTH facts at once -- the log capture is spawned ON THE RESOLVED
# SIMULATOR via `xcrun simctl spawn <udid> log stream ...` (never bare `log stream` on the
# host), and the predicate it's given matches the resolved EXECUTABLE name ("TrueTone"), never
# the bundle id ("com.ayaan47.truetone").
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/xcrun" <<FAKE_XCRUN
#!/usr/bin/env bash
echo "\$@" >> "$XCRUN_CALLS"
if [ "\$1" = "simctl" ] && [ "\$2" = "get_app_container" ]; then
  echo "/fake/TrueTone.app"
  exit 0
fi
if [ "\$1" = "simctl" ] && [ "\$2" = "spawn" ]; then
  shift 3
  for arg in "\$@"; do
    case "\$arg" in
      *processImagePath*) echo "2026-11-13 TrueTone[1234] Default: app lifecycle event" ;;
    esac
  done
  sleep 60
  exit 0
fi
exit 0
FAKE_XCRUN
chmod +x "$FAKE_BIN/xcrun"

rm -f "$XCRUN_CALLS"
set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_1=$?
set -e

assert_exit_code "assert-no-network.sh passes when the simulator-spawned capture is healthy" "0" "$STATUS_1"

assert_contains "the log capture is spawned via 'xcrun simctl spawn <udid> log stream', not bare host log stream" \
  "simctl spawn $FAKE_UDID log stream" "$XCRUN_CALLS"

assert_contains "the app-attributed predicate matches the resolved EXECUTABLE name" \
  'processImagePath ENDSWITH "/TrueTone"' "$XCRUN_CALLS"

assert_not_contains "the predicate no longer matches the bundle identifier" \
  'processImagePath CONTAINS "com.ayaan47.truetone"' "$XCRUN_CALLS"

# -----------------------------------------------------------------------------------------------
# Test 2 (fail-closed): the app isn't installed on the resolved simulator (get_app_container
# fails) -- must fail BEFORE starting any log capture at all, not fall back to the bundle id or
# a hardcoded executable name.
# -----------------------------------------------------------------------------------------------
SPAWN_REACHED="$TMP_ROOT/spawn-reached.log"
rm -f "$SPAWN_REACHED"
cat > "$FAKE_BIN/xcrun" <<FAKE_XCRUN_2
#!/usr/bin/env bash
if [ "\$1" = "simctl" ] && [ "\$2" = "get_app_container" ]; then
  echo "App access string is not valid" >&2
  exit 2
fi
if [ "\$1" = "simctl" ] && [ "\$2" = "spawn" ]; then
  echo "called" >> "$SPAWN_REACHED"
  sleep 60
  exit 0
fi
exit 0
FAKE_XCRUN_2
chmod +x "$FAKE_BIN/xcrun"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_2=$?
set -e

assert_exit_code "assert-no-network.sh fails closed when the executable name can't be resolved" "1" "$STATUS_2"

if [ -f "$SPAWN_REACHED" ]; then
  FAIL=$((FAIL + 1))
  echo "FAIL: assert-no-network.sh must not spawn any log capture when the executable name is unresolved, but it did" >&2
else
  PASS=$((PASS + 1))
fi

echo ""
echo "simulator-log-capture.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
