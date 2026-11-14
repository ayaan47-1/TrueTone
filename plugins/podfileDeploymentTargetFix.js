const MARKER =
  '# truetone: enforce IPHONEOS_DEPLOYMENT_TARGET on every Pods target (HAG-239)';

const LIVE_POST_INSTALL_ANCHOR = /^\s*post_install do \|installer\|\s*$/;
const BLOCK_OPENER_DO = /\bdo\b(\s*\|[^|]*\|)?\s*$/;
const BLOCK_OPENER_KEYWORD = /^\s*(if|unless|case|while|until|begin|def|class|module)\b/;
const BLOCK_CLOSER_END = /^\s*end\b/;

function buildSnippet(minVersion) {
  return [
    `    ${MARKER}`,
    "    installer.pods_project.targets.each do |target|",
    "      target.build_configurations.each do |config|",
    "        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f",
    `        if current != 0 && current < ${minVersion}`,
    `          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minVersion}'`,
    "        end",
    "      end",
    "    end",
    "",
  ].join("\n");
}

// Ruby comments are stripped before anything is checked, so a sweep that only survives inside
// a '#'-disabled line can never be mistaken for a live one. This is intentionally simple (no
// string/interpolation awareness) — sufficient for the generated Podfile this plugin edits,
// never meant to be a general Ruby comment stripper.
function stripRubyLineComment(line) {
  const hashIndex = line.indexOf("#");
  return hashIndex === -1 ? line : line.slice(0, hashIndex);
}

// Finds the first LIVE (uncommented) `post_install do |installer|` block and the line index of
// its matching `end`, by tracking Ruby block depth (do/if/unless/.../end) line by line from the
// anchor onward — not a full parser, but enough to tell a live block's body apart from a
// commented-out one or from text that merely happens to contain the sweep's substrings.
// Returns null if no live anchor exists, or if its block never closes (depth never reaches 0).
function findLivePostInstallBlock(activeLines) {
  const anchorLine = activeLines.findIndex((line) => LIVE_POST_INSTALL_ANCHOR.test(line));
  if (anchorLine === -1) {
    return null;
  }

  let depth = 1;
  for (let i = anchorLine + 1; i < activeLines.length; i++) {
    const line = activeLines[i];
    if (BLOCK_CLOSER_END.test(line)) {
      depth -= 1;
      if (depth === 0) {
        return { anchorLine, endLine: i };
      }
      continue;
    }
    if (BLOCK_OPENER_DO.test(line) || BLOCK_OPENER_KEYWORD.test(line)) {
      depth += 1;
    }
  }
  return null;
}

function bodyHasActiveSweep(activeLines, block, minVersion) {
  if (!block) {
    return false;
  }
  const body = activeLines.slice(block.anchorLine + 1, block.endLine).join("\n");
  return (
    body.includes("installer.pods_project.targets.each do |target|") &&
    body.includes(`config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minVersion}'`)
  );
}

// react-native's own `updateOSDeploymentTarget` (scripts/cocoapods/utils.rb) only walks
// `installer.target_installation_results.pod_target_installation_results` — the per-pod
// library targets. It never touches the resource-bundle / privacy-manifest sub-targets
// CocoaPods generates alongside them (e.g. RNCAsyncStorage-RNCAsyncStorage_resources,
// react-native-view-shot-RNViewShotPrivacyInfo, ShopifyCheckoutSheetKit-ShopifyAcceleratedCheckouts),
// which keep whatever old deployment target each pod's own podspec declares (9.0/13.0/13.4
// here). Xcode's iOS 27.2 SDK hard-floors supported deployment targets at 15.0, turning that
// previously-silent gap into a build failure. Sweeping every target in the Pods project
// (not just the library ones) closes it without touching anything RN already set correctly.
function insertDeploymentTargetFix(podfileContents, minVersion) {
  const originalLines = podfileContents.split("\n");
  const activeLines = originalLines.map(stripRubyLineComment);

  const liveBlock = findLivePostInstallBlock(activeLines);

  if (bodyHasActiveSweep(activeLines, liveBlock, minVersion)) {
    return podfileContents;
  }

  if (podfileContents.includes(MARKER)) {
    // The marker text survives somewhere — as a live comment, double-commented-out, or
    // alongside a disabled sweep — but the live post_install body has no active sweep. Don't
    // silently insert a second one or leave the stale state in place; this needs a human:
    // re-checking structurally (not by substring) is what caught both Scalia round-1
    // (hook/body removed) and round-2 (sweep commented out but left in a live hook) findings.
    throw new Error(
      "podfileDeploymentTargetFix: found the marker comment but no intact, active " +
        "deployment-target sweep inside a live post_install block — the Podfile was edited " +
        "after the fix was applied (e.g. the sweep lines were commented out or the hook was " +
        "changed). Remove the stale marker or restore the active sweep rather than re-running " +
        "this blindly."
    );
  }

  if (!liveBlock) {
    throw new Error(
      'podfileDeploymentTargetFix: could not find a live "post_install do |installer|" block ' +
        "in the generated Podfile; the Expo prebuild template may have changed."
    );
  }

  // Insert right after the anchor line, in the ORIGINAL text (so any surrounding comments are
  // preserved verbatim) — the line index is identical between originalLines and activeLines
  // since stripping a comment never adds or removes a line.
  const insertAt = originalLines.slice(0, liveBlock.anchorLine + 1).join("\n").length + 1;
  return (
    podfileContents.slice(0, insertAt) +
    buildSnippet(minVersion) +
    podfileContents.slice(insertAt)
  );
}

module.exports = { insertDeploymentTargetFix, MARKER };
