#!/usr/bin/env bash
# RED-first shell test for scripts/e2e/lib/network-allowlist.sh (HAG-231, Toby re-review finding
# 3: the allowlist must match a WHOLE hostname, not a substring -- "offline.invalid.attacker.
# example" and "127.0.0.1.evil.example" must be flagged suspicious, not filtered out just
# because they contain an allowed host as a substring). Run directly:
# bash scripts/e2e/lib/__tests__/network-allowlist.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../network-allowlist.sh
source "$ROOT_DIR/scripts/e2e/lib/network-allowlist.sh"

PASS=0
FAIL=0

assert_flagged() {
  local label="$1" host="$2" log_text="$3"
  if filter_suspicious_hosts "$log_text" | grep -qxF "$host"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected '$host' to be flagged suspicious, but it was filtered out" >&2
  fi
}

assert_not_flagged() {
  local label="$1" host="$2" log_text="$3"
  if filter_suspicious_hosts "$log_text" | grep -qxF "$host"; then
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected '$host' to be filtered out, but it was flagged suspicious" >&2
  else
    PASS=$((PASS + 1))
  fi
}

assert_app_flagged() {
  local label="$1" host="$2" log_text="$3"
  if filter_app_attributed_suspicious_hosts "$log_text" | grep -qxF "$host"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected '$host' to be flagged suspicious (app-attributed), but it was filtered out" >&2
  fi
}

assert_app_not_flagged() {
  local label="$1" host="$2" log_text="$3"
  if filter_app_attributed_suspicious_hosts "$log_text" | grep -qxF "$host"; then
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected '$host' to be filtered out (app-attributed), but it was flagged suspicious" >&2
  else
    PASS=$((PASS + 1))
  fi
}

# The two exact attack cases from god's dispatch / Toby's re-review finding 3.
assert_flagged "attacker suffix on the forced-offline host must NOT be allowlisted" \
  "offline.invalid.attacker.example" \
  "2026-11-13 Connecting to offline.invalid.attacker.example on port 443"

assert_flagged "attacker suffix on the loopback IP must NOT be allowlisted" \
  "127.0.0.1.evil.example" \
  "2026-11-13 Request to 127.0.0.1.evil.example failed"

# Dwight re-review (HAG-231, round 5): under the zero-network contract, "offline.invalid" is a
# forced-unreachable CONFIGURATION sentinel (the build-time Shopify/Supabase host), never an
# allowed DESTINATION — any DNS/connection attempt to it is itself the regression this check
# exists to catch, so it must be flagged, not filtered.
assert_flagged "the forced-offline sentinel host is a regression, not an allowlisted destination" \
  "offline.invalid" \
  "2026-11-13 Connected to offline.invalid"

# Loopback (used by the debug harness) remains narrowly allowed.
assert_not_flagged "localhost is still filtered" \
  "localhost" \
  "2026-11-13 Connected to localhost"

# A genuinely unexpected real host must still be flagged (the check's whole purpose).
assert_flagged "an unrelated real host is flagged" \
  "api.real.example" \
  "2026-11-13 Request to api.real.example"

# OS-noise suffix matching: a real Apple subdomain is filtered, but a lookalike host that merely
# contains the noise substring (the same unanchored-match bug, just on the OS-noise list instead
# of the main allowlist) must NOT be filtered.
assert_not_flagged "a real Apple push subdomain is filtered as OS noise" \
  "courier.push.apple.com" \
  "2026-11-13 Connected to courier.push.apple.com"

assert_flagged "a lookalike host containing 'crashlytics' as a substring is NOT OS noise" \
  "evilcrashlytics.attacker.example" \
  "2026-11-13 Request to evilcrashlytics.attacker.example"

assert_not_flagged "the real crashlytics.com host is filtered as OS noise" \
  "crashlytics.com" \
  "2026-11-13 Connected to crashlytics.com"

# Dwight re-review (HAG-231, round 5, re-review of e83ef82): the capture intentionally also
# includes generic "subsystem == com.apple.network" system noise alongside app-attributed lines,
# and the OS-noise suffix exemption was being applied to BOTH -- so a line already attributed by
# the OS to this app's OWN process (processImagePath CONTAINS bundle id) could still have its
# Apple/Crashlytics-domain destination silently exempted as "OS noise", hiding a genuine
# app-originated call to one of those domains. filter_app_attributed_suspicious_hosts is the
# stricter filter for that already-app-scoped stream: NO OS-noise exemption applies, only
# loopback (used by the debug harness) stays allowed.
assert_app_flagged "an app-attributed request to an Apple domain is NOT exempt as OS noise" \
  "push.apple.com" \
  "2026-11-13 TrueTone[1234] Connected to push.apple.com"

assert_app_flagged "an app-attributed request to crashlytics.com is NOT exempt as OS noise" \
  "crashlytics.com" \
  "2026-11-13 TrueTone[1234] Connected to crashlytics.com"

assert_app_flagged "an app-attributed request to the forced-offline sentinel still fails" \
  "offline.invalid" \
  "2026-11-13 TrueTone[1234] Connected to offline.invalid"

assert_app_not_flagged "loopback stays allowed even on the app-attributed stream" \
  "localhost" \
  "2026-11-13 TrueTone[1234] Connected to localhost"

echo ""
echo "network-allowlist.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
