#!/usr/bin/env bash
# Orchestrates one E2E pass: build a variant (if not told to skip), boot the simulator, run that
# variant's Maestro flows, print a pass/fail summary. Run per-variant (so a variant rebuild
# failure doesn't abort the whole suite) or let `npm run e2e:ios` loop over all four.
#
# Usage: run-maestro.sh <demo|shopify-offline|camera-demo|camera-demo-fixture> [simulator name] [runtime name] [--skip-build]
# "physical-device" is NOT run by this script — see docs/ops/e2e.md "Flow 2" for the manual
# `maestro test --device <udid> .maestro/physical-device/` command that needs a real iPhone.
#
# The simulator is resolved by DEVICE NAME + RUNTIME NAME TOGETHER (HAG-231, Toby re-review
# finding 1) -- a same-named device can exist under more than one installed iOS runtime (e.g.
# "iPhone 17" under iOS 26.2, 26.4, and 26.5 on the macos-26 runner image), so name alone is
# ambiguous. See docs/ops/e2e.md "Prerequisites" for which runtime the pinned CI Xcode ships.
set -uo pipefail

VARIANT="${1:?Usage: run-maestro.sh <demo|shopify-offline|camera-demo|camera-demo-fixture> [simulator name] [runtime name] [--skip-build]}"
SIMULATOR="${2:-iPhone 17}"
RUNTIME="${3:-iOS 26.4}"
SKIP_BUILD="${4:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FLOW_DIR="$ROOT_DIR/.maestro/$VARIANT"
# shellcheck source=lib/simulator-resolve.sh
source "$ROOT_DIR/scripts/e2e/lib/simulator-resolve.sh"

if [ ! -d "$FLOW_DIR" ]; then
  echo "No flow directory for variant '$VARIANT' (looked for $FLOW_DIR)" >&2
  exit 1
fi

export PATH="$PATH:$HOME/.maestro/bin"
if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI not found. Install: curl -fsSL \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi

echo "== Resolving simulator '$SIMULATOR' under runtime '$RUNTIME' =="
SIMULATOR_UDID="$(resolve_simulator_udid "$SIMULATOR" "$RUNTIME" "$(xcrun simctl list devices available)")"
if [ -z "$SIMULATOR_UDID" ]; then
  echo "No simulator named '$SIMULATOR' under runtime '$RUNTIME' is installed on this machine." >&2
  echo "Installed devices (xcrun simctl list devices available):" >&2
  xcrun simctl list devices available >&2
  exit 1
fi
echo "== Booting simulator '$SIMULATOR' ($RUNTIME, $SIMULATOR_UDID) =="
xcrun simctl boot "$SIMULATOR_UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$SIMULATOR_UDID" 2>/dev/null || true

if [ "$SKIP_BUILD" != "--skip-build" ]; then
  "$ROOT_DIR/scripts/e2e/build-variant.sh" "$VARIANT" "$SIMULATOR"
fi

echo "== Running Maestro flows: $FLOW_DIR =="
# Toby review finding 2 (HAG-231): the network-silence check (assert-no-network.sh) used to be
# optional/on-request only, so neither this script nor e2e.yml ever actually invoked it -- flow 7
# only asserted the offline-notice UI, which a stray background request could pass alongside.
# Run it for real here, on every local and CI pass, whenever this variant's directory has a
# no-network flow; everything else in the directory still runs as one plain `maestro test`.
NETWORK_CHECK_FLOW="$FLOW_DIR/07_offline_no_network.yaml"
if [ -f "$NETWORK_CHECK_FLOW" ]; then
  OTHER_FLOWS=()
  for f in "$FLOW_DIR"/*.yaml; do
    [ "$f" = "$NETWORK_CHECK_FLOW" ] || OTHER_FLOWS+=("$f")
  done
  OTHER_STATUS=0
  if [ "${#OTHER_FLOWS[@]}" -gt 0 ]; then
    maestro test "${OTHER_FLOWS[@]}"
    OTHER_STATUS=$?
  fi
  "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$NETWORK_CHECK_FLOW"
  NETWORK_STATUS=$?
  STATUS=$OTHER_STATUS
  [ "$STATUS" -eq 0 ] && STATUS=$NETWORK_STATUS
else
  maestro test "$FLOW_DIR"
  STATUS=$?
fi

if [ $STATUS -eq 0 ]; then
  echo "== PASS: $VARIANT =="
else
  echo "== FAIL: $VARIANT (exit $STATUS) =="
fi
exit $STATUS
