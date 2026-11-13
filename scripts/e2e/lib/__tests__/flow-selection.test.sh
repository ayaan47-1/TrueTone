#!/usr/bin/env bash
# RED-first shell test for scripts/e2e/lib/flow-selection.sh (HAG-231, Dwight re-review round 5:
# the fixture scan flow itself must be inside the network capture, not only a separate flow 07
# run after it ends). Feeds synthetic temp directories (no simulator, no maestro, no real app)
# so the "which flows get wrapped in network monitoring" decision can be proven without booting
# anything. Run directly: bash scripts/e2e/lib/__tests__/flow-selection.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../flow-selection.sh
source "$ROOT_DIR/scripts/e2e/lib/flow-selection.sh"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected [$expected], got [$actual]" >&2
  fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A variant directory shaped like camera-demo-fixture: the fixture scan flow (02) plus the
# network-silence flow (07). Every flow in the directory -- 02 included -- must come back, so
# run-maestro.sh can run them all under ONE continuous network capture instead of running 02
# unmonitored and only wrapping 07 afterward.
FIXTURE_DIR="$TMP_ROOT/camera-demo-fixture"
mkdir -p "$FIXTURE_DIR"
touch "$FIXTURE_DIR/02_camera_scan_to_shade_match_fixture.yaml"
touch "$FIXTURE_DIR/07_offline_no_network.yaml"

FIXTURE_FLOWS="$(select_monitored_flows "$FIXTURE_DIR")"
assert_eq "fixture flow 02 is included in the monitored set" \
  "1" \
  "$(printf '%s\n' "$FIXTURE_FLOWS" | grep -c '02_camera_scan_to_shade_match_fixture\.yaml$')"
assert_eq "flow 07 is included in the monitored set" \
  "1" \
  "$(printf '%s\n' "$FIXTURE_FLOWS" | grep -c '07_offline_no_network\.yaml$')"
assert_eq "exactly the directory's two flows are returned, nothing more" \
  "2" \
  "$(printf '%s\n' "$FIXTURE_FLOWS" | grep -c '\.yaml$')"
assert_eq "flow 02 sorts before flow 07 (deterministic run order)" \
  "02_camera_scan_to_shade_match_fixture.yaml" \
  "$(printf '%s\n' "$FIXTURE_FLOWS" | head -n1 | xargs -n1 basename)"

# A variant directory shaped like camera-demo itself: three flows (01, 06, 07) -- all three must
# be returned, not just 07, closing the identical gap for this sibling variant.
CAMERA_DEMO_DIR="$TMP_ROOT/camera-demo"
mkdir -p "$CAMERA_DEMO_DIR"
touch "$CAMERA_DEMO_DIR/01_first_launch_consent.yaml"
touch "$CAMERA_DEMO_DIR/06_camera_permission_denied.yaml"
touch "$CAMERA_DEMO_DIR/07_offline_no_network.yaml"

CAMERA_DEMO_FLOWS="$(select_monitored_flows "$CAMERA_DEMO_DIR")"
assert_eq "camera-demo returns all three of its own flows under monitoring" \
  "3" \
  "$(printf '%s\n' "$CAMERA_DEMO_FLOWS" | grep -c '\.yaml$')"

# A variant directory with NO network-silence flow (e.g. demo/shopify-offline) must signal "not
# monitored" by returning nothing, so the caller falls back to a plain, unmonitored `maestro test`.
DEMO_DIR="$TMP_ROOT/demo"
mkdir -p "$DEMO_DIR"
touch "$DEMO_DIR/03a_catalogue_load.yaml"
touch "$DEMO_DIR/04_add_to_bag.yaml"

DEMO_FLOWS="$(select_monitored_flows "$DEMO_DIR")"
assert_eq "a variant with no network-silence flow returns nothing (unmonitored fallback)" \
  "" \
  "$DEMO_FLOWS"

echo ""
echo "flow-selection.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
