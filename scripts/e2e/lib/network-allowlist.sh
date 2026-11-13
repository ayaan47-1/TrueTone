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
#
# Dwight re-review (HAG-231, round 5): "offline.invalid" is a forced-unreachable CONFIGURATION
# sentinel (the build-time Shopify/Supabase host for camera-demo/camera-demo-fixture), not an
# allowed network DESTINATION. Under the HAG-230 zero-network contract, CAMERA_DEMO makes no
# network calls at all, so a DNS/connection attempt to that sentinel is itself the regression this
# check exists to catch -- it must never be allowlisted. Only loopback, needed for the debug
# harness, stays narrowly allowed.

DOMAIN_PATTERN='[A-Za-z0-9](-?[A-Za-z0-9])*(\.[A-Za-z0-9](-?[A-Za-z0-9])*)+'

# Exact-match only: the WHOLE extracted hostname must equal one of these, never merely contain
# it as a substring.
ALLOWED_EXACT_HOSTS='localhost|127\.0\.0\.1|::1'

# Suffix-match: the WHOLE extracted hostname must equal one of these domains, or end in
# "<dot><domain>". iOS's own connectivity/push infrastructure, unrelated to and not controlled
# by this app. Every alternative is anchored with `(^|\.)...$` - the original bug class applied
# here too ("push.apple" and "crashlytics" had NO anchor at all, so e.g.
# "evilcrashlytics.attacker.example" matched "crashlytics" anywhere in the string).
OS_NOISE_SUFFIX_HOSTS='apple\.com|icloud\.com|push\.apple\.com|mzstatic\.com|crashlytics\.com|crashlytics\.net'

# filter_suspicious_hosts <log-text>
# Prints each distinct hostname-looking token in <log-text> that is neither an exact allowed
# host nor a suffix match of the OS-noise list, one per line, sorted/deduped.
#
# For a GENERIC capture that is NOT scoped to this app's own process (e.g. a system-wide
# "subsystem == com.apple.network" log stream, which also carries unrelated traffic from other
# processes on the machine) -- see filter_app_attributed_suspicious_hosts below for the stricter
# filter used on a capture that IS process-scoped to this app.
filter_suspicious_hosts() {
  local log_text="$1"
  printf '%s\n' "$log_text" \
    | grep -ohE "$DOMAIN_PATTERN" \
    | grep -vxiE "$ALLOWED_EXACT_HOSTS" \
    | grep -viE "(^|\\.)(${OS_NOISE_SUFFIX_HOSTS})\$" \
    | sort -u
}

# filter_app_attributed_suspicious_hosts <log-text>
#
# Dwight re-review (HAG-231, round 5, re-review of e83ef82): assert-no-network.sh used to merge
# an app-process-scoped log stream ("processImagePath CONTAINS bundle id") and a generic
# system-wide one ("subsystem == com.apple.network") into ONE text blob, then ran the single
# OS-noise-exempting filter above over the merged result. Once merged, there was no way to tell
# which extracted hostname came from which stream, so an app-originated request to an
# Apple/Crashlytics domain was silently exempted as "OS noise" exactly like genuine unrelated
# system traffic would be -- hiding a real violation of the zero-network contract.
#
# The fix keeps the two streams in SEPARATE files (assert-no-network.sh now runs two `log
# stream` processes, one per predicate) instead of trying to re-derive attribution from log line
# text after the fact. Call this function ONLY on a capture that the OS itself already scoped to
# this app's own process: every non-loopback hostname found there is a genuine app-originated
# destination by construction, so NO OS-noise exemption applies here -- only the narrow loopback
# entries (needed by the debug harness) are ever allowed. Call filter_suspicious_hosts (above)
# on the separate generic/system-wide capture instead, where the OS-noise exemption is still
# appropriate.
filter_app_attributed_suspicious_hosts() {
  local log_text="$1"
  printf '%s\n' "$log_text" \
    | grep -ohE "$DOMAIN_PATTERN" \
    | grep -vxiE "$ALLOWED_EXACT_HOSTS" \
    | sort -u
}

# build_app_attributed_predicate <bundle-id>
# The `log stream`/`log show` predicate for the stream that IS scoped to this app's own process.
# Field confirmed via `log help predicates`: processImagePath (string); CONTAINS is a supported
# comparison operator.
build_app_attributed_predicate() {
  printf 'processImagePath CONTAINS "%s"' "$1"
}

# build_system_noise_predicate <bundle-id>
#
# Dwight re-review (HAG-231, round 6): the generic/system-wide capture used to be
# `subsystem == "com.apple.network"` alone -- scoped by subsystem only, with NO check on which
# process a line came from. That let a TrueTone-attributed line reach the OS-noise-exempting
# filter whenever it happened to land in this stream instead of (or in addition to) the
# app-attributed one, and let a line with no real process attribution at all pass the exemption
# too, purely because nothing positively ruled it out. The required rule is the other way round:
# OS-noise exemption may apply ONLY when a line is positively attributed to some OTHER, specific,
# non-TrueTone process -- never when it's unattributed, and never when it's this app.
#
# This predicate enforces that at the OS/kernel level (not by re-deriving attribution from
# rendered log text afterward, which is what caused the round-5 bug): `processImagePath != ""`
# requires a real, non-empty process attribution (rejects unattributed lines), and
# `NOT (processImagePath CONTAINS bundle-id)` excludes this app specifically. Fields/operators
# confirmed via `log help predicates` on this machine: processImagePath (string), operators
# include !=, CONTAINS, NOT.
build_system_noise_predicate() {
  printf 'subsystem == "com.apple.network" AND processImagePath != "" AND NOT (processImagePath CONTAINS "%s")' "$1"
}
