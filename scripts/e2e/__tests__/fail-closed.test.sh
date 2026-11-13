#!/usr/bin/env bash
# Integration regression tests for HAG-231 round 6 (Toby's two re-review HIGHs on `e83ef82`,
# review-toby.md "Re-review at e83ef82 (round 5)" section):
#   1. run-maestro.sh ignored build-variant.sh's exit status, so a failed Expo build could still
#      run Maestro against a stale/older install and report PASS.
#   2. assert-no-network.sh ignored `log stream`'s own exit status and never checked whether the
#      capture process was actually still running -- a `log stream` that failed to start (e.g.
#      permission denied) or died partway through the flow run produced an empty file,
#      indistinguishable from a genuinely clean capture, and the check PASSED either way.
#
# Stubs npx/maestro/xcrun/log with fake executables (no real build, no real Simulator, no real
# log stream) so each failure mode can be reproduced deterministically.
#
# Run directly: bash scripts/e2e/__tests__/fail-closed.test.sh
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

cat > "$FAKE_BIN/open" <<'FAKE_OPEN'
#!/usr/bin/env bash
exit 0
FAKE_OPEN
chmod +x "$FAKE_BIN/open"

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

FLOW_FILE="$TMP_ROOT/fake_flow.yaml"
printf 'appId: com.ayaan47.truetone\n---\n- launchApp\n' > "$FLOW_FILE"

# -----------------------------------------------------------------------------------------------
# Test 1: a `log stream` that fails to start immediately must fail the whole check, not pass an
# empty capture.
#
# Before the fix, assert-no-network.sh never checked whether the backgrounded `log` process was
# still alive; an immediately-exiting `log` produced an empty file, `filter_*_suspicious_hosts`
# on empty text returns nothing suspicious, and the script printed PASS.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO_OK'
#!/usr/bin/env bash
exit 0
FAKE_MAESTRO_OK
chmod +x "$FAKE_BIN/maestro"

cat > "$FAKE_BIN/log" <<'FAKE_LOG_DEAD_ON_ARRIVAL'
#!/usr/bin/env bash
exit 1
FAKE_LOG_DEAD_ON_ARRIVAL
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_1=$?
set -e

assert_exit_code "assert-no-network.sh fails when log stream exits immediately (capture never started)" \
  "1" "$STATUS_1"

# -----------------------------------------------------------------------------------------------
# Test 2: a `log stream` that dies partway through the flow run must also fail, not just one that
# never started.
#
# Timing: the fake maestro sleeps 2s (simulating flow execution); the fake log here survives the
# initial 1s "did it start" check but dies at 1.5s, before maestro finishes -- so only the SECOND
# liveness check (taken right after maestro returns, before the deliberate kill) can catch it.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO_SLOW'
#!/usr/bin/env bash
sleep 2
exit 0
FAKE_MAESTRO_SLOW
chmod +x "$FAKE_BIN/maestro"

cat > "$FAKE_BIN/log" <<'FAKE_LOG_DIES_MIDRUN'
#!/usr/bin/env bash
sleep 1.5
exit 1
FAKE_LOG_DIES_MIDRUN
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_2=$?
set -e

assert_exit_code "assert-no-network.sh fails when a log stream dies before the flow(s) finish" \
  "1" "$STATUS_2"

# -----------------------------------------------------------------------------------------------
# Test 3 (no-regression): with both log captures healthy (alive throughout) and the flow passing,
# the check must still exit 0 -- the fail-closed checks above must not make the happy path fail.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO_OK2'
#!/usr/bin/env bash
exit 0
FAKE_MAESTRO_OK2
chmod +x "$FAKE_BIN/maestro"

cat > "$FAKE_BIN/log" <<'FAKE_LOG_HEALTHY'
#!/usr/bin/env bash
# A real app process always emits SOME log activity while running (launch, lifecycle,
# framework diagnostics) even with zero network traffic -- simulate that for the
# app-attributed predicate only (identified by its argv), matching what Test 4/5 below rely
# on to distinguish "healthy but quiet" from "broken capture, no output at all".
for arg in "$@"; do
  case "$arg" in
    *processImagePath*) echo "2026-11-13 TrueTone[1234] Default: app lifecycle event" ;;
  esac
done
sleep 60
FAKE_LOG_HEALTHY
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_3=$?
set -e

assert_exit_code "assert-no-network.sh still passes when both captures stay alive and the flow passes" \
  "0" "$STATUS_3"

# -----------------------------------------------------------------------------------------------
# Test 5: the THIRD distinct failure mode (god's round-6 dispatch names it explicitly) -- a log
# capture process that stays alive for the whole run but produces literally no output at all.
# This is NOT caught by the liveness checks above (the process never died), only by checking the
# captured file's content.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/log" <<'FAKE_LOG_SILENT'
#!/usr/bin/env bash
# Alive the whole time, writes nothing at all -- simulates a logging-privacy/config issue that
# silently yields zero events despite the process running fine.
sleep 60
FAKE_LOG_SILENT
chmod +x "$FAKE_BIN/log"

set +e
PATH="$FAKE_BIN:$PATH" bash "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$FAKE_UDID" "$FLOW_FILE" >/dev/null 2>&1
STATUS_5=$?
set -e

assert_exit_code "assert-no-network.sh fails when a live capture produces no output at all (empty capture)" \
  "1" "$STATUS_5"

# -----------------------------------------------------------------------------------------------
# Test 4: run-maestro.sh must fail when build-variant.sh fails, not silently run Maestro against
# whatever is already installed.
#
# Before the fix, run-maestro.sh's call to build-variant.sh had its exit status ignored entirely
# (`set -uo pipefail` with no `-e` and no explicit check) -- a build failure fell straight through
# to the Maestro run, which could still report PASS against a stale install.
# -----------------------------------------------------------------------------------------------
cat > "$FAKE_BIN/npx" <<'FAKE_NPX_FAILS'
#!/usr/bin/env bash
echo "simulated build failure" >&2
exit 1
FAKE_NPX_FAILS
chmod +x "$FAKE_BIN/npx"

cat > "$FAKE_BIN/maestro" <<'FAKE_MAESTRO_WOULD_PASS'
#!/usr/bin/env bash
# If run-maestro.sh reaches this at all after a failed build, that is itself the bug -- record it
# so the test can tell the difference between "never called" and "called but ignored".
echo "called" >> "$MAESTRO_REACHED_LOG"
exit 0
FAKE_MAESTRO_WOULD_PASS
chmod +x "$FAKE_BIN/maestro"

MAESTRO_REACHED="$TMP_ROOT/maestro-reached.log"
rm -f "$MAESTRO_REACHED"

set +e
MAESTRO_REACHED_LOG="$MAESTRO_REACHED" PATH="$FAKE_BIN:$PATH" \
  bash "$ROOT_DIR/scripts/e2e/run-maestro.sh" demo "iPhone 17" "iOS 26.4" >/dev/null 2>&1
STATUS_4=$?
set -e

assert_exit_code "run-maestro.sh fails when build-variant.sh (expo build) fails" \
  "1" "$STATUS_4"

if [ -f "$MAESTRO_REACHED" ]; then
  FAIL=$((FAIL + 1))
  echo "FAIL: run-maestro.sh must not run Maestro at all after a failed build, but it did" >&2
else
  PASS=$((PASS + 1))
fi

echo ""
echo "fail-closed.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
