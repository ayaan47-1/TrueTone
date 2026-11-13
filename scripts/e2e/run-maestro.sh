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
#
# Fail-closed sweep (HAG-231 round 6, Toby re-review HIGH 1): `-e` is on script-wide; a build
# failure used to fall straight through to the Maestro run (no `-e`, no explicit status check),
# so Maestro could pass against whatever was already installed on the simulator even though the
# build that was supposed to replace it had just failed. Every command whose status this script
# wants to inspect itself, rather than let `-e` abort on, is wrapped in an `if`/`||` form, which
# bash's `-e` rules exempt from the abort-on-failure behavior.
set -euo pipefail

VARIANT="${1:?Usage: run-maestro.sh <demo|shopify-offline|camera-demo|camera-demo-fixture> [simulator name] [runtime name] [--skip-build]}"
SIMULATOR="${2:-iPhone 17}"
RUNTIME="${3:-iOS 26.4}"
SKIP_BUILD="${4:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FLOW_DIR="$ROOT_DIR/.maestro/$VARIANT"
# shellcheck source=lib/simulator-resolve.sh
source "$ROOT_DIR/scripts/e2e/lib/simulator-resolve.sh"
# shellcheck source=lib/flow-selection.sh
source "$ROOT_DIR/scripts/e2e/lib/flow-selection.sh"

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
# `|| true` absorbs resolve_simulator_udid's expected exit-1-on-not-found status so the bare
# assignment doesn't trip `-e` before the explicit "is it empty" check below gets to run and
# print the diagnostic.
SIMULATOR_UDID="$(resolve_simulator_udid "$SIMULATOR" "$RUNTIME" "$(xcrun simctl list devices available)" || true)"
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
  # Toby re-review (HAG-231, round 5): pass the resolved UDID through, not just the name --
  # otherwise Expo's device resolver can match a same-named simulator booted under a DIFFERENT
  # runtime (see build-variant.sh's comment), silently installing onto the wrong one.
  #
  # Toby re-review HIGH 1 (HAG-231, round 6): explicitly check the build's own exit status.
  # Without this, a failed build fell straight through to the Maestro run below, which could
  # still pass against an OLDER app already installed on the simulator -- exactly the kind of
  # build failure this suite exists to catch, masked.
  if ! "$ROOT_DIR/scripts/e2e/build-variant.sh" "$VARIANT" "$SIMULATOR" "$SIMULATOR_UDID"; then
    echo "FAIL: build-variant.sh failed for variant '$VARIANT' -- refusing to run Maestro against a stale or missing build" >&2
    exit 1
  fi
fi

echo "== Running Maestro flows: $FLOW_DIR =="
# Toby review finding 2 (HAG-231): the network-silence check (assert-no-network.sh) used to be
# optional/on-request only, so neither this script nor e2e.yml ever actually invoked it -- flow 7
# only asserted the offline-notice UI, which a stray background request could pass alongside.
# Dwight re-review round 5: running every OTHER flow unmonitored and wrapping only flow 7 left
# the fixture scan itself (camera-demo-fixture's flow 02 -- the one flow that actually exercises
# the capture/read/persist path) outside the capture window, so a fixture-only outbound request
# could slip through undetected. Whenever this variant's directory has a no-network flow, run
# EVERY flow in it (select_monitored_flows, scripts/e2e/lib/flow-selection.sh) inside ONE
# continuous network capture instead.
# Toby re-review (HAG-231, round 5): every `maestro test` call below is pinned to the exact
# resolved $SIMULATOR_UDID via `--device`, for the same reason the build is -- Maestro has no
# runtime-aware resolution of its own and would otherwise run against whichever same-named
# simulator happens to be in the foreground/booted.
MONITORED_FLOWS_RAW="$(select_monitored_flows "$FLOW_DIR")"
if [ -n "$MONITORED_FLOWS_RAW" ]; then
  MONITORED_FLOWS=()
  while IFS= read -r f; do
    MONITORED_FLOWS+=("$f")
  done < <(printf '%s\n' "$MONITORED_FLOWS_RAW")
  # `if cmd; then ... else ...; fi` (not a bare `cmd; STATUS=$?`) so `-e` doesn't abort before
  # this script gets to capture the status itself and print its own PASS/FAIL line.
  if "$ROOT_DIR/scripts/e2e/assert-no-network.sh" "$SIMULATOR_UDID" "${MONITORED_FLOWS[@]}"; then
    STATUS=0
  else
    STATUS=$?
  fi
else
  if maestro test --device "$SIMULATOR_UDID" "$FLOW_DIR"; then
    STATUS=0
  else
    STATUS=$?
  fi
fi

if [ $STATUS -eq 0 ]; then
  echo "== PASS: $VARIANT =="
else
  echo "== FAIL: $VARIANT (exit $STATUS) =="
fi
exit $STATUS
