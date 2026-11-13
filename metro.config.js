const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = withNativeWind(getSentryExpoConfig(__dirname, {
  getDefaultConfig,
  annotateReactComponents: false,
  includeWebReplay: false,
  includeWebFeedback: false,
  enableSourceContextInDevelopment: false,
  optionsFile: false,
  injectReleaseForWeb: false,
}), { input: './global.css' });
