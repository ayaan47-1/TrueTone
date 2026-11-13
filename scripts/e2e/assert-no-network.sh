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
# Exit 0 = no suspicious outbound connection seen. Exit 1 = one was seen (prints it).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib/network-allowlist.sh
source "$ROOT_DIR/scripts/e2e/lib/network-allowlist.sh"

if [ "$#" -lt 2 ]; then
  echo "Usage: assert-no-network.sh <device-udid> <maestro-flow-path> [<maestro-flow-path> ...]" >&2
  exit 1
fi
DEVICE_UDID="$1"
shift
FLOW_PATHS=("$@")
BUNDLE_ID="com.ayaan47.truetone"
LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"' EXIT

export PATH="$PATH:$HOME/.maestro/bin"

echo "== Starting log capture for $BUNDLE_ID =="
log stream --predicate "processImagePath CONTAINS \"$BUNDLE_ID\" OR subsystem == \"com.apple.network\"" \
  --style compact > "$LOG_FILE" &
LOG_PID=$!

echo "== Running flow(s) on device $DEVICE_UDID: ${FLOW_PATHS[*]} =="
maestro test --device "$DEVICE_UDID" "${FLOW_PATHS[@]}"
FLOW_STATUS=$?

sleep 2
kill "$LOG_PID" 2>/dev/null || true
wait "$LOG_PID" 2>/dev/null || true

echo "== Scanning captured log for any outbound destination outside the loopback allowlist =="
# Toby review finding 2 (HAG-231) + re-review finding 3: a 3-item blacklist
# (supabase.co/myshopify.com/shopify.com) misses any other real host a regression might call,
# AND the allowlist itself must match a WHOLE hostname, never a substring ("offline.invalid.
# attacker.example" and "127.0.0.1.evil.example" must NOT be treated as an allowed host just
# because they contain one). Dwight re-review round 5: "offline.invalid" itself is no longer
# allowlisted either -- it's the build-time config sentinel, not a permitted destination, so a
# connection attempt TO it is the exact regression this check exists to catch. The filtering
# logic lives in scripts/e2e/lib/network-allowlist.sh (sourced above) so it can be unit-tested
# directly -- see scripts/e2e/lib/__tests__/network-allowlist.test.sh.
SUSPICIOUS="$(filter_suspicious_hosts "$(cat "$LOG_FILE" 2>/dev/null)")"

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
