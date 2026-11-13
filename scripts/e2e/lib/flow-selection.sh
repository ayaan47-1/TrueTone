#!/usr/bin/env bash
# scripts/e2e/lib/flow-selection.sh
#
# Decides which flows in a variant's .maestro/<variant>/ directory must run INSIDE the
# network-silence capture, factored out so it can be unit-tested against a synthetic temp
# directory without booting a simulator or invoking maestro (HAG-231, Dwight re-review round 5).
#
# Previous bug: run-maestro.sh ran every flow EXCEPT 07_offline_no_network.yaml as a plain,
# unmonitored `maestro test`, then started log capture only for flow 07 by itself. For
# camera-demo-fixture, that meant the fixture scan (flow 02 -- the one flow that actually
# exercises the capture/read/persist path) ran with no network log capture at all; flow 07 opens
# a fresh app instance and never touches that path, so a fixture-only outbound request could slip
# through undetected while the job still passed.
#
# Fix: when a variant directory has a network-silence flow, EVERY flow in that directory --
# the fixture scan included -- runs under one continuous log capture (see
# scripts/e2e/assert-no-network.sh, which now accepts multiple flow paths and runs them as one
# `maestro test` invocation). This function returns the full, sorted flow list in that case, or
# nothing when no network-silence flow exists, signalling "unmonitored" to the caller.
#
# Not run directly; sourced by scripts/e2e/run-maestro.sh. See
# scripts/e2e/lib/__tests__/flow-selection.test.sh for the test harness.

# select_monitored_flows <flow-dir>
# Prints every *.yaml flow in <flow-dir>, one per line, sorted, IF <flow-dir> contains
# 07_offline_no_network.yaml. Prints nothing otherwise.
select_monitored_flows() {
  local flow_dir="$1"
  [ -f "$flow_dir/07_offline_no_network.yaml" ] || return 0
  local f
  for f in "$flow_dir"/*.yaml; do
    [ -e "$f" ] && printf '%s\n' "$f"
  done | sort
}
