const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withSentryConfig } = require('@sentry/react-native/metro');

module.exports = withNativeWind(withSentryConfig(getDefaultConfig(__dirname), {
  annotateReactComponents: false,
  includeWebReplay: false,
  includeWebFeedback: false,
  enableSourceContextInDevelopment: false,
  optionsFile: false,
}), { input: './global.css' });
