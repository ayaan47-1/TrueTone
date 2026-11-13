#!/usr/bin/env bash
# Builds and installs one of the named env variants onto an iOS Simulator, as a local dev-client
# build (expo run:ios). This mirrors the env shapes already in eas.json's build profiles, just
# run locally against a simulator instead of through EAS. See docs/ops/e2e.md for the full
# rationale and when each variant is used.
set +x
set -euo pipefail

VARIANT="${1:?Usage: build-variant.sh <demo|shopify-offline|camera-demo|camera-demo-fixture> [simulator name] [simulator udid]}"
SIMULATOR="${2:-iPhone 17}"
# Toby re-review (HAG-231, round 5): passing only a device NAME to `expo run:ios --device` lets
# Expo's own device resolver pick the FIRST matching name among installed simulators
# (node_modules/expo/node_modules/@expo/cli/build/src/run/ios/options/resolveDevice.js:
# findDeviceFromSearchValue matches name OR udid) -- if a same-named simulator under a different
# iOS runtime happens to already be booted, Expo can install onto that one instead of the exact
# runtime run-maestro.sh resolved and booted. Passing the UDID instead removes the ambiguity
# entirely, since the resolver matches it exactly. Optional so this script still works stand-alone
# (no caller-resolved UDID) with name-based resolution as before.
SIMULATOR_UDID="${3:-}"

# Reads one KEY=value line out of an env-style file without ever printing the value. Only an
# exact "KEY=" at line start matches; if the key appears more than once, the last line wins
# (shell env-file convention). Never used on anything but TT_ENV_FILE, and never logged.
read_env_var() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2-
}

case "$VARIANT" in
  demo)
    # EXPO_PUBLIC_DEMO=1 (mirrors eas.json's "preview" profile). profile-context.tsx
    # pre-resolves route='home' and NEVER calls Supabase under DEMO_MODE - no age-gate, no
    # consent screen, /scan is redirect-blocked. Crucially, DEMO_MODE does NOT gate the
    # Shop/bag/checkout surface (only SUPABASE_OFFLINE/CAMERA_DEMO does), so this build reaches
    # real Shopify Storefront traffic with zero Supabase involvement - needs a real Shopify
    # domain/token but no Supabase credentials at all.
    export EXPO_PUBLIC_DEMO=1
    unset EXPO_PUBLIC_CAMERA_DEMO || true
    # TT_ENV_FILE (default: unset -> nothing read): path to a .env-style file holding the three
    # EXPO_PUBLIC_SHOPIFY_* vars. This NEVER copies, commits, or reads the file into this repo -
    # it only greps three specific keys out of it into this process's environment, and nothing
    # here echoes or logs their values (set +x above, and no `env`/`export -p` dump anywhere in
    # this script). Example: TT_ENV_FILE=/Users/ayaan/Projects/GitHub/TrueTone/.env.
    if [ -n "${TT_ENV_FILE:-}" ]; then
      [ -f "$TT_ENV_FILE" ] || { echo "TT_ENV_FILE='$TT_ENV_FILE' does not exist" >&2; exit 1; }
      [ -z "${EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN:-}" ] && export EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN="$(read_env_var EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN "$TT_ENV_FILE")"
      [ -z "${EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN:-}" ] && export EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="$(read_env_var EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN "$TT_ENV_FILE")"
      [ -z "${EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS:-}" ] && export EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS="$(read_env_var EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS "$TT_ENV_FILE")"
    fi
    : "${EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN:?demo variant needs EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN — set it directly, or point TT_ENV_FILE at a .env that has it}"
    : "${EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN:?demo variant needs EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN — set it directly, or point TT_ENV_FILE at a .env that has it}"
    ;;
  shopify-offline)
    # Same EXPO_PUBLIC_DEMO=1 as "demo", except the Shopify host is swapped for an unreachable
    # one so the catalogue retry state (flow 03b) is deterministic without any live network
    # dependency. Reuses the same unreachable-host pattern eas.json's "testflight-camera"
    # profile already uses. No Supabase credentials needed here either (same reason as "demo").
    export EXPO_PUBLIC_DEMO=1
    unset EXPO_PUBLIC_CAMERA_DEMO || true
    export EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN="offline.invalid"
    export EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="offline"
    export EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS="offline.invalid"
    ;;
  camera-demo)
    # EXPO_PUBLIC_CAMERA_DEMO=1 (mirrors eas.json's "camera-demo"/"testflight-camera" profiles).
    # UNLIKE demo, the real /age-gate + /consent screens render and need real taps -
    # profile-context.tsx persists the result to local state instead of Supabase, so the flow
    # still works with no live backend. /scan mounts <Capture> (only build where that's true).
    # SUPABASE_OFFLINE (== CAMERA_DEMO) forces every Shopify screen into ShopOfflineNotice
    # regardless of what the Shopify vars say, so they're pointed offline here too - nothing
    # this build does can write anywhere real. Same flag the three-principal dogfood build uses
    # (docs/ops/camera-on-testflight-compliance.md); gated to a device the developer owns - here,
    # the local Simulator, never anything uploaded or distributed.
    export EXPO_PUBLIC_CAMERA_DEMO=1
    export EXPO_PUBLIC_DEMO=0
    export EXPO_PUBLIC_SUPABASE_URL="http://offline.invalid"
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="offline"
    export EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN="offline.invalid"
    export EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="offline"
    export EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS="offline.invalid"
    ;;
  camera-demo-fixture)
    # Same env as "camera-demo", PLUS EXPO_PUBLIC_E2E_FIXTURE_SCAN=1 (HAG-231 flow 2). This is a
    # SEPARATE build from plain "camera-demo": src/lib/e2e-fixture.ts's flag, when on, makes
    # app/scan/index.tsx skip mounting <Capture> entirely once gates clear — flow 6 (camera
    # permission denied) needs the real <Capture> permission UI to render, so it must NOT share
    # a binary with this variant. Still __DEV__ (a Debug build), so the flag is live; it is
    # structurally inert on any Release/EAS build regardless of this var (see e2e-fixture.ts).
    export EXPO_PUBLIC_CAMERA_DEMO=1
    export EXPO_PUBLIC_DEMO=0
    export EXPO_PUBLIC_E2E_FIXTURE_SCAN=1
    export EXPO_PUBLIC_SUPABASE_URL="http://offline.invalid"
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="offline"
    export EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN="offline.invalid"
    export EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN="offline"
    export EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS="offline.invalid"
    ;;
  *)
    echo "Unknown variant '$VARIANT' (expected demo|shopify-offline|camera-demo|camera-demo-fixture)" >&2
    exit 1
    ;;
esac

if [ -n "$SIMULATOR_UDID" ]; then
  echo "== Building variant '$VARIANT' for simulator '$SIMULATOR' ($SIMULATOR_UDID) =="
  npx expo run:ios --device "$SIMULATOR_UDID"
else
  echo "== Building variant '$VARIANT' for simulator '$SIMULATOR' =="
  npx expo run:ios --device "$SIMULATOR"
fi
