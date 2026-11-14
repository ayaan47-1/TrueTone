const MARKER =
  '# truetone: enforce IPHONEOS_DEPLOYMENT_TARGET on every Pods target (HAG-239)';

const POST_INSTALL_ANCHOR = /post_install do \|installer\|\r?\n/;

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
  if (podfileContents.includes(MARKER)) {
    return podfileContents;
  }

  const match = podfileContents.match(POST_INSTALL_ANCHOR);
  if (!match) {
    throw new Error(
      'podfileDeploymentTargetFix: could not find "post_install do |installer|" in the ' +
        "generated Podfile; the Expo prebuild template may have changed."
    );
  }

  const insertAt = match.index + match[0].length;
  return (
    podfileContents.slice(0, insertAt) +
    buildSnippet(minVersion) +
    podfileContents.slice(insertAt)
  );
}

module.exports = { insertDeploymentTargetFix, MARKER };
