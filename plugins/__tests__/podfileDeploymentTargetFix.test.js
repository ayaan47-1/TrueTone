const {
  insertDeploymentTargetFix,
  MARKER,
} = require('../podfileDeploymentTargetFix');

const SAMPLE_PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '16.4'

target 'TrueTone' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

test('inserts the deployment-target sweep right after post_install opens', () => {
  const result = insertDeploymentTargetFix(SAMPLE_PODFILE, '15.1');

  expect(result).toContain(MARKER);
  expect(result).toContain('installer.pods_project.targets.each do |target|');
  expect(result).toContain("config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'");

  const postInstallIndex = result.indexOf('post_install do |installer|');
  const sweepIndex = result.indexOf(MARKER);
  const reactNativePostInstallIndex = result.indexOf('react_native_post_install(');
  expect(sweepIndex).toBeGreaterThan(postInstallIndex);
  expect(sweepIndex).toBeLessThan(reactNativePostInstallIndex);
});

test('only raises targets below the floor, never lowers an already-higher one', () => {
  const result = insertDeploymentTargetFix(SAMPLE_PODFILE, '15.1');

  expect(result).toMatch(/current = config\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\]\.to_f/);
  expect(result).toMatch(/if current != 0 && current < 15\.1/);
});

test('is idempotent: calling twice does not duplicate the sweep', () => {
  const once = insertDeploymentTargetFix(SAMPLE_PODFILE, '15.1');
  const twice = insertDeploymentTargetFix(once, '15.1');

  expect(twice).toBe(once);
  const occurrences = twice.split(MARKER).length - 1;
  expect(occurrences).toBe(1);
});

test('throws loudly if the Podfile template no longer has a post_install block', () => {
  const noPostInstall = "platform :ios, '16.4'\ntarget 'TrueTone' do\nend\n";

  expect(() => insertDeploymentTargetFix(noPostInstall, '15.1')).toThrow(
    /post_install do \|installer\|/
  );
});

test('throws loudly when the marker comment survives but post_install was removed entirely', () => {
  // Reproduces Scalia's finding: a Podfile that kept the marker as a stray comment but lost
  // the post_install block (and therefore the sweep) it was supposed to prove was installed.
  const markerWithoutHook = [
    "platform :ios, '16.4'",
    "target 'TrueTone' do",
    `  ${MARKER}`,
    "end",
    "",
  ].join("\n");

  expect(() => insertDeploymentTargetFix(markerWithoutHook, '15.1')).toThrow(
    /marker comment.*but.*post_install/is
  );
});

test('throws loudly when the marker comment survives but the sweep body under it was stripped', () => {
  // post_install still exists, but someone deleted the target-sweep lines underneath the
  // marker comment while leaving the comment itself in place.
  const markerWithEmptyHook = [
    "platform :ios, '16.4'",
    "target 'TrueTone' do",
    "  post_install do |installer|",
    `    ${MARKER}`,
    "    react_native_post_install(installer)",
    "  end",
    "end",
    "",
  ].join("\n");

  expect(() => insertDeploymentTargetFix(markerWithEmptyHook, '15.1')).toThrow(
    /marker comment.*but.*post_install/is
  );
});
