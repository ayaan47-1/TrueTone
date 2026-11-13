#!/usr/bin/env bash
# Companion to flow 7 (camera-demo/07_offline_no_network.yaml). Maestro itself cannot assert "no
# network call happened" - this tails the simulator's unified log for the app's process while the
# flow runs and fails if any outbound connection attempt to a real (non-"offline.invalid") host
# shows up. This is a belt-and-braces runtime check on top of the UI-level proof the Maestro flow
# already gives (that the ShopOfflineNotice-guarded code path, not a live Shopify/Supabase call,
# is what actually renders).
#
# Usage: assert-no-network.sh <maestro-flow-path>
# Exit 0 = no suspicious outbound connection seen. Exit 1 = one was seen (prints it).
set -uo pipefail

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

echo "== Scanning captured log for outbound connections to a real host =="
# "offline.invalid" is the only host these builds are configured to resolve against; a real
# supabase.co / myshopify.com / shopify.com hit here means a guard regressed.
if grep -iE "(supabase\.co|myshopify\.com|shopify\.com)" "$LOG_FILE" > /dev/null; then
  echo "FAIL: found a reference to a live Supabase/Shopify host during the camera-offline flow:" >&2
  grep -iE "(supabase\.co|myshopify\.com|shopify\.com)" "$LOG_FILE" >&2
  exit 1
fi

if [ "$FLOW_STATUS" -ne 0 ]; then
  echo "FAIL: the underlying Maestro flow itself failed (exit $FLOW_STATUS)" >&2
  exit "$FLOW_STATUS"
fi

echo "PASS: no live Supabase/Shopify host reference seen during the flow"
