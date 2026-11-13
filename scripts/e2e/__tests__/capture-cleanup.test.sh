#!/usr/bin/env bash
# RED-first integration test for HAG-231 round 8 (Toby re-review at `2022e3c`, review-toby.md
# latest MEDIUM): assert-no-network.sh:79,91-106 -- if ONE of the two simulator log-stream
# captures dies at startup, the script's own liveness check correctly fails it (exit 1), but the
# EXIT trap only ever removed the two temp files; it never killed or reaped the OTHER capture,
# which was still alive and backgrounded. That surviving `xcrun simctl spawn ... log stream`
# process leaked past the script's own exit as an orphan.
#
# Proves, for BOTH orderings (app-attributed stream dies / system-noise stream dies), that: (1)
# the script still exits non-zero, and (2) the SURVIVING capture process is no longer running
# once the script has exited -- not just "eventually," immediately after. Stubs xcrun/plutil/log
# so no real Simulator is touched.
#
# Run directly: bash scripts/e2e/__tests__/capture-cleanup.test.sh
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

TMP_ROOT="$(mktemp -d)"
FAKE_BIN="$TMP_ROOT/bin"
mkdir -p "$FAKE_BIN"
trap 'rm -rf "$TMP_ROOT"' EXIT

FLOW_FILE="$TMP_ROOT/fake_flow.yaml"
printf 'appId: com.ayaan47.truetone\n---\n- launchApp\n' > "$FLOW_FILE"

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

cat > "$FAKE_BIN/xcrun" <<'FAKE_XCRUN'
#!/usr/bin/env bash
if [ "$1" = "simctl" ] && [ "$2" = "get_app_container" ]; then
  echo "/fake/TrueTone.app"
  exit 0
fi
if [ "$1" = "simctl" ] && [ "$2" = "spawn" ]; then
  shift 3
  exec "$@"
fi
exit 0
FAKE_XCRUN
chmod +x "$FAKE_BIN/xcrun"

# -----------------------------------------------------------------------------------------------
# Case A: the APP-attributed stream dies at startup; the SYSTEM-noise stream would otherwise
# survive. The survivor writes its own PID to a file right before sleeping, so the test can check
# from OUTSIDE the script whether that exact process is still alive after the script exits.
# -----------------------------------------------------------------------------------------------
SURVIVOR_PID_FILE_A="$TMP_ROOT/survivor-a.pid"
rm -f "$SURVIVOR_PID_FILE_A"

cat > "$FAKE_BIN/log" <<FAKE_LOG_CASE_A
#!/usr/bin/env bash
for arg in "\$@"; do
  case "\$arg" in
    *subsystem*)
      echo \$\$ > "$SURVIVOR_PID_FILE_A"
      sleep 30
      exit 0
      ;;
  esac
done
# The app-attributed stream (no "subsystem" in its predicate) dies at startup.
exit 1
FAKE_LOG_CASE_A
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_A=$?
set -e

assert_exit_code "assert-no-network.sh exits non-zero when the app-attributed stream dies at startup" "1" "$STATUS_A"

if [ -f "$SURVIVOR_PID_FILE_A" ]; then
  SURVIVOR_PID_A="$(cat "$SURVIVOR_PID_FILE_A")"
  if kill -0 "$SURVIVOR_PID_A" 2>/dev/null; then
    FAIL=$((FAIL + 1))
    echo "FAIL: the system-noise capture (pid $SURVIVOR_PID_A) is still running after assert-no-network.sh exited -- it leaked" >&2
    kill "$SURVIVOR_PID_A" 2>/dev/null || true
  else
    PASS=$((PASS + 1))
  fi
else
  FAIL=$((FAIL + 1))
  echo "FAIL: the system-noise capture never started at all -- test setup is broken, not proving the fix" >&2
fi

# -----------------------------------------------------------------------------------------------
# Case B: the SYSTEM-noise stream dies at startup; the APP-attributed stream would otherwise
# survive. Mirrors Case A with the roles reversed, proving the fix kills whichever PID survives,
# not just one of the two.
# -----------------------------------------------------------------------------------------------
SURVIVOR_PID_FILE_B="$TMP_ROOT/survivor-b.pid"
rm -f "$SURVIVOR_PID_FILE_B"

cat > "$FAKE_BIN/log" <<FAKE_LOG_CASE_B
#!/usr/bin/env bash
for arg in "\$@"; do
  case "\$arg" in
    *subsystem*)
      # The system-noise stream dies at startup.
      exit 1
      ;;
  esac
done
# The app-attributed stream survives.
echo \$\$ > "$SURVIVOR_PID_FILE_B"
sleep 30
exit 0
FAKE_LOG_CASE_B
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_B=$?
set -e

assert_exit_code "assert-no-network.sh exits non-zero when the system-noise stream dies at startup" "1" "$STATUS_B"

if [ -f "$SURVIVOR_PID_FILE_B" ]; then
  SURVIVOR_PID_B="$(cat "$SURVIVOR_PID_FILE_B")"
  if kill -0 "$SURVIVOR_PID_B" 2>/dev/null; then
    FAIL=$((FAIL + 1))
    echo "FAIL: the app-attributed capture (pid $SURVIVOR_PID_B) is still running after assert-no-network.sh exited -- it leaked" >&2
    kill "$SURVIVOR_PID_B" 2>/dev/null || true
  else
    PASS=$((PASS + 1))
  fi
else
  FAIL=$((FAIL + 1))
  echo "FAIL: the app-attributed capture never started at all -- test setup is broken, not proving the fix" >&2
fi

echo ""
echo "capture-cleanup.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
