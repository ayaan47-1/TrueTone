#!/usr/bin/env bash
# Companion to flow 7 (camera-demo/07_offline_no_network.yaml). Maestro itself cannot assert "no
# network call happened" - this tails the simulator's unified log for the app's process while the
# flow runs and fails if any outbound connection attempt to a real (non-"offline.invalid") host
# shows up. This is a runtime check on top of the UI-level proof the Maestro flow already gives
# (that the ShopOfflineNotice-guarded code path, not a live Shopify/Supabase call, is what
# actually renders).
#
# Invoked automatically by scripts/e2e/run-maestro.sh for every camera-demo/camera-demo-fixture
# run, local and CI (Toby review finding 2, HAG-231) -- it used to be optional/callable-on-request
# only, so a background request could slip through flow 7 with the offline notice still visible
# and the suite would stay green. Not something to call directly; run-maestro.sh wires it in.
#
# Usage: assert-no-network.sh <maestro-flow-path>
# Exit 0 = no suspicious outbound connection seen. Exit 1 = one was seen (prints it).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib/network-allowlist.sh
source "$ROOT_DIR/scripts/e2e/lib/network-allowlist.sh"

FLOW_PATH="${1:?Usage: assert-no-network.sh <maestro-flow-path>}"
BUNDLE_ID="com.ayaan47.truetone"
LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"' EXIT

export PATH="$PATH:$HOME/.maestro/bin"

echo "== Starting log capture for $BUNDLE_ID =="
log stream --predicate "processImagePath CONTAINS \"$BUNDLE_ID\" OR subsystem == \"com.apple.network\"" \
  --style compact > "$LOG_FILE" &
LOG_PID=$!

echo "== Running flow: $FLOW_PATH =="
maestro test "$FLOW_PATH"
FLOW_STATUS=$?

sleep 2
kill "$LOG_PID" 2>/dev/null || true
wait "$LOG_PID" 2>/dev/null || true

echo "== Scanning captured log for any outbound destination outside the offline allowlist =="
# Toby review finding 2 (HAG-231) + re-review finding 3: a 3-item blacklist
# (supabase.co/myshopify.com/shopify.com) misses any other real host a regression might call,
# AND the allowlist itself must match a WHOLE hostname, never a substring ("offline.invalid.
# attacker.example" and "127.0.0.1.evil.example" must NOT be treated as the real offline/
# loopback host just because they contain it). The filtering logic lives in
# scripts/e2e/lib/network-allowlist.sh (sourced above) so it can be unit-tested directly --
# see scripts/e2e/lib/__tests__/network-allowlist.test.sh.
SUSPICIOUS="$(filter_suspicious_hosts "$(cat "$LOG_FILE" 2>/dev/null)")"

if [ -n "$SUSPICIOUS" ]; then
  echo "FAIL: found outbound destination(s) outside the offline allowlist during the camera-offline flow:" >&2
  echo "$SUSPICIOUS" >&2
  exit 1
fi

if [ "$FLOW_STATUS" -ne 0 ]; then
  echo "FAIL: the underlying Maestro flow itself failed (exit $FLOW_STATUS)" >&2
  exit "$FLOW_STATUS"
fi

echo "PASS: no live Supabase/Shopify host reference seen during the flow"
