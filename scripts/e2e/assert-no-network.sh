#!/usr/bin/env bash
# Companion to a variant's network-silence flow (<variant>/07_offline_no_network.yaml). Maestro
# itself cannot assert "no network call happened" - this tails the simulator's unified log for
# the app's process while the given flow(s) run and fails if any outbound connection attempt to a
# real host shows up. This is a runtime check on top of the UI-level proof the Maestro flow
# already gives (that the ShopOfflineNotice-guarded code path, not a live Shopify/Supabase call,
# is what actually renders).
#
# Accepts ONE OR MORE flow paths, all run under the SAME continuous log capture (Dwight re-review
# round 5, HAG-231): run-maestro.sh used to run every flow except 07 unmonitored and start this
# script's log capture only for flow 07 by itself, so a variant's earlier flows (e.g.
# camera-demo-fixture's flow 02, the fixture scan that actually exercises the capture/read/
# persist path) could make an outbound request undetected -- flow 07 opens a fresh app instance
# and never touches that path. Pass the WHOLE variant flow list (see
# scripts/e2e/lib/flow-selection.sh) so every flow in the directory is inside the capture window,
# not just the network-silence flow itself.
#
# Invoked automatically by scripts/e2e/run-maestro.sh for every camera-demo/camera-demo-fixture
# run, local and CI (Toby review finding 2, HAG-231) -- it used to be optional/callable-on-request
# only, so a background request could slip through flow 7 with the offline notice still visible
# and the suite would stay green. Not something to call directly; run-maestro.sh wires it in.
#
# Usage: assert-no-network.sh <device-udid> <maestro-flow-path> [<maestro-flow-path> ...]
# <device-udid> is passed straight through to `maestro test --device` (Toby re-review finding,
# HAG-231 round 5) so this check runs against the exact simulator run-maestro.sh resolved and
# booted, not whichever same-named simulator Maestro would otherwise pick.
# Exit 0 = no suspicious outbound connection seen AND both log captures ran for the whole flow.
# Exit 1 = a suspicious connection was seen, a capture never started, or a capture died mid-run.
#
# Fail-closed sweep (HAG-231 round 6, Toby re-review HIGH 2): a `log stream` that fails to start
# (log service/permissions issue) or dies partway through used to leave its file empty with no
# exit-status check at all -- an empty capture and a genuinely clean capture were indistinguishable,
# so a broken capture silently PASSED. `-e` is on script-wide; every command whose status this
# script wants to inspect itself (rather than let `-e` abort on) is wrapped in an `if`/`||` form,
# which bash's `-e` rules exempt from the abort-on-failure behavior.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib/network-allowlist.sh
source "$ROOT_DIR/scripts/e2e/lib/network-allowlist.sh"
# shellcheck source=lib/app-executable.sh
source "$ROOT_DIR/scripts/e2e/lib/app-executable.sh"

if [ "$#" -lt 2 ]; then
  echo "Usage: assert-no-network.sh <device-udid> <maestro-flow-path> [<maestro-flow-path> ...]" >&2
  exit 1
fi
DEVICE_UDID="$1"
shift
FLOW_PATHS=("$@")
BUNDLE_ID="com.ayaan47.truetone"

# Toby re-review (HAG-231, round 7): the predicates below used to match processImagePath against
# $BUNDLE_ID directly, which never appears in a process's filesystem path (see
# network-allowlist.sh's comments). Resolve the actual EXECUTABLE name off the app installed on
# THIS resolved simulator before starting any capture -- fail closed (no capture, no Maestro run)
# if it can't be resolved, rather than falling back to the bundle id or a hardcoded guess.
EXECUTABLE_NAME="$(resolve_app_executable_name "$DEVICE_UDID" "$BUNDLE_ID" || true)"
if [ -z "$EXECUTABLE_NAME" ]; then
  echo "FAIL: could not resolve the installed app's executable name on simulator $DEVICE_UDID (bundle $BUNDLE_ID) -- is the app installed/booted there?" >&2
  exit 1
fi
echo "== Resolved app executable on $DEVICE_UDID: $EXECUTABLE_NAME =="
# Dwight re-review (HAG-231, round 5, re-review of e83ef82): these two predicates used to be
# OR'd into ONE `log stream` call, merged into one text blob -- which meant an outbound
# connection the OS attributed to this app's OWN process (processImagePath CONTAINS bundle id)
# was indistinguishable, once captured, from the generic system-wide "com.apple.network" noise
# alongside it. The OS-noise exemption (Apple/Crashlytics domains) therefore applied to BOTH,
# silently hiding an app-originated request to one of those domains. Keeping the two streams in
# SEPARATE files -- one `log stream` process per predicate -- preserves attribution at the
# source instead of trying to re-derive it from log line text afterward.
#
# Dwight re-review round 6: the system-noise predicate is further scoped (via
# build_system_noise_predicate, scripts/e2e/lib/network-allowlist.sh) so the OS-noise exemption
# can only ever apply to a line positively attributed to SOME OTHER, specific, non-TrueTone
# process -- never to an unattributed line, and never to this app.
APP_LOG_FILE="$(mktemp)"
SYSTEM_LOG_FILE="$(mktemp)"
APP_LOG_PID=""
SYSTEM_LOG_PID=""

# Toby re-review (HAG-231, round 8, review-toby.md latest MEDIUM): this trap used to only remove
# the two temp files. If one capture died at startup (or any other early-exit path fired before
# this script reached its own deliberate `kill` near the end), the OTHER capture -- an
# `xcrun simctl spawn ... log stream` process, backgrounded and still running -- was never killed
# or reaped at all. It leaked past this script's own exit as an orphan. cleanup() kills and waits
# on every PID that was actually started, guarding with `kill -0` first since one may already be
# dead (an already-reaped PID is a no-op here, not an error), then removes the files. Registered
# on EXIT (covers both a normal exit and a `set -e` abort) and ERR; INT/TERM get their own traps
# that `exit` with the conventional 128+signal code, since bash resumes the script after a
# trapped signal's handler returns rather than terminating on its own once a handler is
# registered -- that `exit` itself triggers the EXIT trap below, running cleanup exactly once.
cleanup() {
  local pid
  for pid in "${APP_LOG_PID:-}" "${SYSTEM_LOG_PID:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -f "$APP_LOG_FILE" "$SYSTEM_LOG_FILE"
}
trap cleanup EXIT ERR
trap 'exit 130' INT
trap 'exit 143' TERM

export PATH="$PATH:$HOME/.maestro/bin"

# Toby re-review (HAG-231, round 7): this used to run bare `log stream` on the HOST, not the
# resolved simulator -- on a machine with more than one simulator/device, a host-wide log stream
# proves nothing about which device actually produced any given line. `xcrun simctl spawn
# "$DEVICE_UDID" log stream ...` runs the capture ON that exact simulator instead (same pattern
# Flutter's own simulator log reader uses), tying it to the device run-maestro.sh resolved,
# booted, and built onto -- the same device-pinning discipline as the build/Maestro --device
# flags already have (rounds 5-6).
echo "== Starting log capture on $DEVICE_UDID for executable $EXECUTABLE_NAME (app-attributed + system network noise) =="
xcrun simctl spawn "$DEVICE_UDID" log stream --predicate "$(build_app_attributed_predicate "$EXECUTABLE_NAME")" --style compact > "$APP_LOG_FILE" &
APP_LOG_PID=$!
xcrun simctl spawn "$DEVICE_UDID" log stream --predicate "$(build_system_noise_predicate "$EXECUTABLE_NAME")" --style compact > "$SYSTEM_LOG_FILE" &
SYSTEM_LOG_PID=$!

# Toby re-review HIGH 2: confirm both captures actually started (are still running, not already
# dead) BEFORE trusting them to observe the flow run. A `log stream` that fails immediately
# (e.g. permission denied) must not be allowed to silently produce an empty, falsely-clean file.
sleep 1
if ! kill -0 "$APP_LOG_PID" 2>/dev/null; then
  echo "FAIL: the app-attributed log capture exited immediately -- log stream failed to start" >&2
  exit 1
fi
if ! kill -0 "$SYSTEM_LOG_PID" 2>/dev/null; then
  echo "FAIL: the system-wide log capture exited immediately -- log stream failed to start" >&2
  exit 1
fi

echo "== Running flow(s) on device $DEVICE_UDID: ${FLOW_PATHS[*]} =="
if maestro test --device "$DEVICE_UDID" "${FLOW_PATHS[@]}"; then
  FLOW_STATUS=0
else
  FLOW_STATUS=$?
fi

# Toby re-review HIGH 2 (continued): check BEFORE killing whether either capture already died on
# its own sometime during the flow run -- that's a silent mid-run capture failure, distinct from
# (and not detectable via) the exit status AFTER we deliberately kill it below.
APP_LOG_DIED=0
kill -0 "$APP_LOG_PID" 2>/dev/null || APP_LOG_DIED=1
SYSTEM_LOG_DIED=0
kill -0 "$SYSTEM_LOG_PID" 2>/dev/null || SYSTEM_LOG_DIED=1

sleep 2
kill "$APP_LOG_PID" "$SYSTEM_LOG_PID" 2>/dev/null || true
wait "$APP_LOG_PID" "$SYSTEM_LOG_PID" 2>/dev/null || true

if [ "$APP_LOG_DIED" -eq 1 ] || [ "$SYSTEM_LOG_DIED" -eq 1 ]; then
  echo "FAIL: a log capture process exited before the flow(s) finished -- an incomplete capture cannot be trusted as a pass" >&2
  exit 1
fi

# Fail-closed sweep (HAG-231 round 6): a THIRD distinct failure mode from "the process never
# started" and "the process died mid-run" -- a `log stream` that stays alive the whole time but
# writes literally nothing (e.g. a logging-privacy/config issue that silently yields zero
# events) is indistinguishable from a genuinely clean run once filtered. The app-attributed
# predicate has no subsystem restriction at all, so it captures every log line this app's own
# process emits during a real run (launch, lifecycle, framework diagnostics, ...) -- a totally
# empty app-attributed capture means the capture mechanism itself didn't work, not that the app
# was silent. The generic system-wide stream is NOT held to this rule: it's narrowly scoped
# (network-subsystem activity from some OTHER specific process, HAG-231 round 6 above), and a
# short flow run with no such activity from any other process is a normal, expected result, not
# a broken capture.
if [ ! -s "$APP_LOG_FILE" ]; then
  echo "FAIL: the app-attributed log capture produced no output at all during the flow(s) -- a running app always emits SOME log activity, so an empty capture here means the capture mechanism itself is broken, not that nothing happened" >&2
  exit 1
fi

echo "== Scanning captured log for any outbound destination outside the loopback allowlist =="
# Toby review finding 2 (HAG-231) + re-review finding 3: a 3-item blacklist
# (supabase.co/myshopify.com/shopify.com) misses any other real host a regression might call,
# AND the allowlist itself must match a WHOLE hostname, never a substring ("offline.invalid.
# attacker.example" and "127.0.0.1.evil.example" must NOT be treated as an allowed host just
# because they contain one). Dwight re-review round 5: "offline.invalid" itself is no longer
# allowlisted either -- it's the build-time config sentinel, not a permitted destination, so a
# connection attempt TO it is the exact regression this check exists to catch. The APP-attributed
# stream gets the strict filter (no OS-noise exemption at all -- see
# filter_app_attributed_suspicious_hosts's comment); only the generic system-wide stream keeps
# the OS-noise exemption, since it alone is genuinely dominated by unrelated system traffic. Both
# live in scripts/e2e/lib/network-allowlist.sh so they can be unit-tested directly -- see
# scripts/e2e/lib/__tests__/network-allowlist.test.sh.
# Each of these pipelines ends in `grep`, which exits 1 (its own convention for "no lines
# matched") whenever the clean/expected result is "nothing suspicious found" -- under `pipefail`
# that makes the WHOLE pipeline's status nonzero even though nothing went wrong, and under `-e` a
# bare `VAR="$(...)"` assignment whose command exits nonzero aborts the script immediately
# (the classic `x=$(false)` gotcha). `|| true` inside each substitution absorbs that expected
# "no matches" status without masking a genuine script error elsewhere.
APP_SUSPICIOUS="$(filter_app_attributed_suspicious_hosts "$(cat "$APP_LOG_FILE" 2>/dev/null)" || true)"
SYSTEM_SUSPICIOUS="$(filter_suspicious_hosts "$(cat "$SYSTEM_LOG_FILE" 2>/dev/null)" || true)"
SUSPICIOUS="$(printf '%s\n%s\n' "$APP_SUSPICIOUS" "$SYSTEM_SUSPICIOUS" | grep -v '^$' | sort -u || true)"

if [ -n "$SUSPICIOUS" ]; then
  echo "FAIL: found outbound destination(s) outside the zero-network contract during the capture window:" >&2
  echo "$SUSPICIOUS" >&2
  exit 1
fi

if [ "$FLOW_STATUS" -ne 0 ]; then
  echo "FAIL: the underlying Maestro flow(s) failed (exit $FLOW_STATUS)" >&2
  exit "$FLOW_STATUS"
fi

echo "PASS: no live Supabase/Shopify host reference seen during the capture window"
