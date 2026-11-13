import type { ReactNativeOptions } from '@sentry/react-native';
import { DEMO_MODE, SUPABASE_OFFLINE } from '../supabase';
import { CRASH_RELEASE, guardCrashTransport, scrubCrashBreadcrumb, scrubCrashEvent } from './privacy';

let initialized = false;
// Unknown until the root renders; startup and deep links fail closed.
let currentRoute = '';
let visitedSensitiveFlow = false;

export function setCrashReportingRoute(route: string): void {
  // Bundled async stacks cannot always identify their originating feature after navigation.
  if (/^\/(?:scan(?:[-/]|$)|routine(?:\/|$)|shade-feedback(?:\/|$)|setup(?:\/|$)|consent(?:\/|$)|data(?:\/|$)|bbox-overlay(?:\/|$)|\(dev\))/.test(route)) visitedSensitiveFlow = true;
  currentRoute = visitedSensitiveFlow ? '' : route;
}

export function initializeCrashReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  const fixtureBuild = /^(1|true|yes|on)$/i.test((process.env.EXPO_PUBLIC_E2E ?? '').trim());
  if (initialized || !dsn || DEMO_MODE || SUPABASE_OFFLINE || __DEV__ || process.env.NODE_ENV === 'test' || fixtureBuild) return;
  // A runtime require deliberately stays behind the off-mode gate. Type-only imports load nothing.
  const sentry: typeof import('@sentry/react-native') = require('@sentry/react-native');
  const { createTransport }: typeof import('@sentry/core') = require('@sentry/core');
  const options: ReactNativeOptions = {
    dsn, debug: false, sendDefaultPii: false,
    enableNative: false, autoInitializeNativeSdk: false, enableNativeCrashHandling: false,
    enableNativeNagger: false, enableAppHangTracking: false, enableJsHangTracking: false,
    enableNdk: false, enableNativeFramesTracking: false, enableWatchdogTerminationTracking: false,
    enableNetworkBreadcrumbs: false, enableNetworkEventBreadcrumbs: false, enableAutoBreadcrumbTracking: false,
    enableActivityLifecycleBreadcrumbs: false, enableAppLifecycleBreadcrumbs: false,
    enableSystemEventBreadcrumbs: false, enableAppComponentBreadcrumbs: false,
    enableUserInteractionBreadcrumbs: false, enableUserInteractionTracing: false, enableCaptureFailedRequests: false,
    attachScreenshot: false, attachViewHierarchy: false,
    enableLogs: false, enableAutoConsoleLogs: false,
    enableAutoSessionTracking: false, sendClientReports: false,
    enableAutoPerformanceTracing: false, enableAppStartTracking: false, enableStallTracking: false,
    tracesSampleRate: 0, profilesSampleRate: 0,
    replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0, defaultIntegrations: false,
    integrations: [sentry.reactNativeErrorHandlersIntegration(), sentry.debugMetaIntegration()],
    beforeBreadcrumb: scrubCrashBreadcrumb,
    beforeSend: (event, hint) => scrubCrashEvent(event, hint, currentRoute),
    beforeSendTransaction: () => null,
    transport: settings => guardCrashTransport(createTransport(settings, async ({ body }) => {
      // Only a JSON error item can reach this transport; binary attachments are forbidden.
      if (typeof body !== 'string') return { statusCode: 400 };
      const response = await fetch(settings.url, { method: 'POST', body, redirect: 'error' });
      return { statusCode: response.status, headers: {
        'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'),
        'retry-after': response.headers.get('retry-after'),
      } };
    }), () => currentRoute),
    release: CRASH_RELEASE, environment: 'production',
  };
  sentry.init(options);
  initialized = true;
}
