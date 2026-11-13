const enabled = value => /^(1|true|yes|on)$/i.test((value ?? '').trim());

module.exports = ({ config }) => {
  const productionReporting = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()) &&
    !enabled(process.env.EXPO_PUBLIC_DEMO) && !enabled(process.env.EXPO_PUBLIC_CAMERA_DEMO) &&
    !enabled(process.env.EXPO_PUBLIC_E2E) && process.env.NODE_ENV !== 'test' &&
    (!process.env.EAS_BUILD_PROFILE || process.env.EAS_BUILD_PROFILE === 'production');
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['@sentry/react-native/expo', {
      useNativeInit: false,
      // The token is only tested for presence. Never copy it into Expo's public config.
      disableAutoUpload: !productionReporting || !process.env.SENTRY_AUTH_TOKEN,
      ...(process.env.SENTRY_ORG ? { organization: process.env.SENTRY_ORG } : {}),
      ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
    }]],
  };
};
