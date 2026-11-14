const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");
const { insertDeploymentTargetFix } = require("./podfileDeploymentTargetFix");

// Matches react-native's own `min_ios_version_supported` floor (scripts/cocoapods/helpers.rb),
// which is also the lowest deployment target Xcode 27's iOS SDK accepts. See
// podfileDeploymentTargetFix.js for why this sweep is needed at all.
const MIN_IOS_DEPLOYMENT_TARGET = "15.1";

function withIOSDeploymentTargetFix(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      const contents = fs.readFileSync(podfilePath, "utf8");
      fs.writeFileSync(
        podfilePath,
        insertDeploymentTargetFix(contents, MIN_IOS_DEPLOYMENT_TARGET)
      );
      return config;
    },
  ]);
}

module.exports = withIOSDeploymentTargetFix;
