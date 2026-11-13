import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DISABLED = ['sendDefaultPii','enableNative','autoInitializeNativeSdk','enableNativeCrashHandling',
  'attachScreenshot','attachViewHierarchy','enableLogs','enableAutoConsoleLogs','enableAutoSessionTracking',
  'sendClientReports','enableAutoPerformanceTracing','enableAppStartTracking','enableStallTracking',
  'enableAppHangTracking','enableJsHangTracking','defaultIntegrations','enableNdk','enableNativeFramesTracking',
  'enableWatchdogTerminationTracking','enableNetworkBreadcrumbs','enableNetworkEventBreadcrumbs','enableAutoBreadcrumbTracking',
  'enableActivityLifecycleBreadcrumbs','enableAppLifecycleBreadcrumbs','enableSystemEventBreadcrumbs',
  'enableAppComponentBreadcrumbs','enableUserInteractionBreadcrumbs','enableUserInteractionTracing','enableCaptureFailedRequests'];
const ZERO = ['tracesSampleRate','profilesSampleRate','replaysSessionSampleRate','replaysOnErrorSampleRate','maxBreadcrumbs'];
const FORBIDDEN = /\b(?:setUser|addAttachment|captureMessage|captureFeedback|setContext|setExtra|setExtras|setTag|setTags|startSpan|startInactiveSpan|mobileReplayIntegration|browserReplayIntegration|feedbackIntegration|consoleLoggingIntegration|reactNativeTracingIntegration)\s*\(/;

export function checkCrashReporting(runtime, sources = []) {
  const errors = [];
  for (const [names,value] of [[DISABLED,'false'],[ZERO,'0']]) {
    for (const name of names) if (!new RegExp(`\\b${name}:\\s*${value}\\b`).test(runtime)) errors.push(`Keep ${name} explicitly ${value}`);
  }
  if (FORBIDDEN.test(runtime)) errors.push('Crash reporting may only install the JS unhandled-error handlers');
  for (const call of runtime.matchAll(/\bsentry\.(\w+)\s*\(/g)) {
    if (!['init','reactNativeErrorHandlersIntegration','debugMetaIntegration'].includes(call[1])) errors.push(`Unapproved crash SDK API: ${call[1]}`);
  }
  for (const source of sources) {
    if (/@sentry\/|crash-reporting/.test(source.text)) errors.push(`Crash SDK use outside its boundary: ${source.path}`);
  }
  return errors;
}

function walk(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const path=join(directory,entry.name);
    if (entry.isDirectory()) return entry.name==='__tests__' || path==='src/lib/crash-reporting' ? [] : walk(path);
    if (!/\.tsx?$/.test(path)) return [];
    const text = readFileSync(path,'utf8');
    // This is the only approved caller. Any direct SDK import in the root still fails.
    return [{path,text:path==='app/_layout.tsx' ? text.replace("import { initializeCrashReporting, setCrashReportingRoute } from '../src/lib/crash-reporting/runtime';",'') : text}];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors=checkCrashReporting(readFileSync('src/lib/crash-reporting/runtime.ts','utf8'), [...walk('src'),...walk('app')]);
  if(errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
  else console.log('compliance: crash reporting stays inside the scrubbed, crash-only boundary');
}
