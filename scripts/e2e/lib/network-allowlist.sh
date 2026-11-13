#!/usr/bin/env bash
# scripts/e2e/lib/network-allowlist.sh
#
# Shared hostname extraction + allowlist filtering for assert-no-network.sh, factored out so it
# can be unit-tested against synthetic log text without booting a simulator (HAG-231, Toby
# re-review finding 3): the previous filter used unanchored `grep -viE` substring matching, so a
# logged host like "offline.invalid.attacker.example" or "127.0.0.1.evil.example" was silently
# dropped from the suspicious list just for CONTAINING an allowed host, even though it is a
# different, attacker-controlled host. Every check below matches the WHOLE extracted hostname
# (exact match, or an anchored "<dot><suffix>"/exact-domain suffix match) - never a bare
# substring.
#
# Not run directly; sourced by assert-no-network.sh. See
# scripts/e2e/lib/__tests__/network-allowlist.test.sh for a test harness that feeds this
# synthetic log text instead of a real unified-log capture.

DOMAIN_PATTERN='[A-Za-z0-9](-?[A-Za-z0-9])*(\.[A-Za-z0-9](-?[A-Za-z0-9])*)+'

# Exact-match only: the WHOLE extracted hostname must equal one of these, never merely contain
# it as a substring.
ALLOWED_EXACT_HOSTS='offline\.invalid|localhost|127\.0\.0\.1|::1'

# Suffix-match: the WHOLE extracted hostname must equal one of these domains, or end in
# "<dot><domain>". iOS's own connectivity/push infrastructure, unrelated to and not controlled
# by this app. Every alternative is anchored with `(^|\.)...$` - the original bug class applied
# here too ("push.apple" and "crashlytics" had NO anchor at all, so e.g.
# "evilcrashlytics.attacker.example" matched "crashlytics" anywhere in the string).
OS_NOISE_SUFFIX_HOSTS='apple\.com|icloud\.com|push\.apple\.com|mzstatic\.com|crashlytics\.com|crashlytics\.net'

# filter_suspicious_hosts <log-text>
# Prints each distinct hostname-looking token in <log-text> that is neither an exact allowed
# host nor a suffix match of the OS-noise list, one per line, sorted/deduped.
filter_suspicious_hosts() {
  local log_text="$1"
  printf '%s\n' "$log_text" \
    | grep -ohE "$DOMAIN_PATTERN" \
    | grep -vxiE "$ALLOWED_EXACT_HOSTS" \
    | grep -viE "(^|\\.)(${OS_NOISE_SUFFIX_HOSTS})\$" \
    | sort -u
}
