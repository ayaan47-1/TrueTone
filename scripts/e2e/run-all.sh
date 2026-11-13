#!/usr/bin/env bash
# Runs every Maestro flow variant for one platform and prints a per-flow pass/fail summary.
# Usage: run-all.sh <ios|android> [simulator/emulator name]
set -uo pipefail

PLATFORM="${1:?Usage: run-all.sh <ios|android> [device name]}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$PLATFORM" = "android" ]; then
  echo "Android E2E is not runnable in this environment: no Android SDK / emulator image is" >&2
  echo "installed here (checked: no \$ANDROID_HOME, no 'emulator' binary). The flow files under" >&2
  echo ".maestro/ are platform-agnostic Maestro YAML and will run unchanged against an Android" >&2
  echo "emulator once one exists (adb device, app installed) - see docs/ops/e2e.md 'Android'" >&2
  echo "for the one setup step this needs (an AVD) before 'maestro test .maestro/<variant>' works." >&2
  exit 1
fi

DEVICE="${2:-iPhone 17}"
# "physical-device" (flow 2's real-camera variant) is deliberately excluded - it needs a real
# iPhone, not this script's simulator loop. See docs/ops/e2e.md "Flow 2".
VARIANTS=(demo shopify-offline camera-demo camera-demo-fixture)
declare -A RESULTS

for variant in "${VARIANTS[@]}"; do
  echo ""
  echo "######################################################################"
  echo "# Variant: $variant"
  echo "######################################################################"
  if "$ROOT_DIR/scripts/e2e/run-maestro.sh" "$variant" "$DEVICE"; then
    RESULTS[$variant]="PASS"
  else
    RESULTS[$variant]="FAIL"
  fi
done

echo ""
echo "======================================================================"
echo "E2E summary ($PLATFORM, $DEVICE)"
echo "======================================================================"
OVERALL=0
for variant in "${VARIANTS[@]}"; do
  printf "%-20s %s\n" "$variant" "${RESULTS[$variant]}"
  [ "${RESULTS[$variant]}" = "FAIL" ] && OVERALL=1
done
exit $OVERALL
