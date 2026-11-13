import type { Breadcrumb, ErrorEvent, Event, EventHint, StackFrame, Transport, EventEnvelope } from '@sentry/core';
import { z } from 'zod';
import app from '../../../app.json';
import sentryPackage from '@sentry/react-native/package.json';

export const CRASH_RELEASE = `truetone@${app.expo.version}`;

const SAFE_ROUTES = new Set(['/shop', '/shop-bag', '/bag']);
const BUNDLE_NAMES = new Set(['index.android.bundle', 'index.ios.bundle', 'index.bundle', 'main.jsbundle', 'main.js', 'index.js']);
const ERROR_TYPES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError']);
const SENSITIVE_SOURCE = /(?:features[\\/](?:capture|read|shade|match)|app[\\/]scan|bbox-overlay)/i;
const SENSITIVE_WORD = /biometric|health|skin|shade|score|undertone|depth|match|routine|recommendation|account|profile|user|email|phone|consent|token|authorization|cookie|supabase|shopify|scan|capture|camera|face|geometry|pixel|colour|color|image|photo|landmark|rawlab|labvalue|ipaddress/;
const debugIdSchema = z.string().uuid();
const debugMetaSchema = z.object({ images:z.array(z.object({
  type:z.literal('sourcemap'),
  debug_id:debugIdSchema,
  code_file:z.enum(['app:///main.jsbundle','app:///index.android.bundle']),
})).min(1).max(1) });

/** Inspect before projection, including fields that the output schema will discard. */
function hasSensitiveData(input: unknown): boolean {
  const seen = new WeakSet<object>();
  let visited = 0;
  function blocked(value: unknown, depth: number, path: readonly string[] = []): boolean {
    if (++visited > 10000 || depth > 12) return true;
    if (typeof value === 'string') {
      const normalized = value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
      return SENSITIVE_WORD.test(normalized) || /\b(?:lab|olive|warm|cool|neutral|match)\b/i.test(value) ||
        /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i.test(value) || /(?:file|content|data):/i.test(value);
    }
    if (!value || typeof value !== 'object') return false;
    if (seen.has(value)) return true;
    seen.add(value);
    return Object.entries(value).some(([key,entry]) => {
      if (entry === undefined || entry === null) return false;
      // Exempt only validated technical fields at their approved paths.
      const imagesKey = path.length===1 && path[0]==='debug_meta' && key==='images';
      const buildId = path.length===3 && path[0]==='debug_meta' && path[1]==='images' && key==='debug_id' && debugIdSchema.safeParse(entry).success;
      const eventId = path.length===0 && key==='event_id' && typeof entry==='string' && /^[a-f0-9]{32}$/i.test(entry);
      const timestamp = path.length===0 && key==='timestamp' && typeof entry==='number' && Number.isFinite(entry);
      return !buildId && !eventId && !timestamp && ((!imagesKey && blocked(key,depth+1)) || blocked(entry,depth+1,[...path,key]));
    });
  }
  try { return blocked(input,0); }
  catch { return true; }
}

function isReportableRoute(route: string): boolean {
  return SAFE_ROUTES.has(route) || /^\/shop-product\/[^/?#]+$/.test(route);
}

function scrubFrame(frame: StackFrame, canonicalFile?: string): StackFrame | null {
  const filename = frame.filename?.split(/[?#]/, 1)[0].split(/[\\/]/).pop();
  if (!filename || !BUNDLE_NAMES.has(filename)) return null;
  return {
    filename: canonicalFile ?? filename,
    ...(Number.isSafeInteger(frame.lineno) && (frame.lineno ?? -1) >= 0 ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) && (frame.colno ?? -1) >= 0 ? { colno: frame.colno } : {}),
  };
}

/** No console, HTTP, UI or navigation breadcrumbs are retained, even outside the camera. */
export function scrubCrashBreadcrumb(_breadcrumb: Breadcrumb): null {
  return null;
}

/** Reconstruct, rather than delete named keys: new SDK context fields are excluded by default. */
export function scrubCrashEvent(event: Event, hint: EventHint, route: string): ErrorEvent | null {
  hint.attachments = [];
  if (!isReportableRoute(route) || event.type || !event.exception?.values?.length || hasSensitiveData(event)) return null;
  if (event.exception.values.some(value => value.stacktrace?.frames?.some(frame => SENSITIVE_SOURCE.test(frame.filename ?? '')))) return null;
  const parsedDebug = debugMetaSchema.safeParse(event.debug_meta);
  const debugMeta = parsedDebug.success ? parsedDebug.data : undefined;
  const values = event.exception.values.slice(0, 4).flatMap(value => {
    const frames = (value.stacktrace?.frames ?? []).slice(-60).flatMap(frame => {
      const safe = scrubFrame(frame,debugMeta?.images[0].code_file);
      return safe ? [safe] : [];
    });
    if (!frames.length) return [];
    return [{ type: ERROR_TYPES.has(value.type ?? '') ? value.type : 'Error', value: 'Crash details redacted', stacktrace: { frames } }];
  });
  if (!values.length) return null;
  return {
    type: undefined, platform: 'javascript', level: event.level === 'fatal' ? 'fatal' : 'error', exception: { values },
    sdk: { name: 'sentry.javascript.react-native', version: sentryPackage.version, settings: { infer_ip: 'never' } },
    ...(debugMeta ? {debug_meta:debugMeta} : {}),
    ...(event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
  };
}

const envelopeEvent = z.object({
  type: z.literal('transaction').optional(),
  event_id: z.string().optional(), timestamp: z.number().optional(),
  level: z.enum(['fatal','error','warning','info','debug']).optional(),
  debug_meta:debugMetaSchema.optional(),
  exception: z.object({ values: z.array(z.object({
    type: z.string().optional(),
    stacktrace: z.object({ frames: z.array(z.object({
      filename: z.string().optional(), lineno: z.number().optional(), colno: z.number().optional(),
    })) }).optional(),
  })) }),
});

/** The SDK can bypass beforeSend for its own errors. Enforce the same boundary at transport too. */
export function guardCrashTransport(inner: Transport, route: () => string): Transport {
  return {
    send(envelope) {
      for (const [header,payload] of envelope[1]) {
        if (header.type !== 'event') continue;
        if (hasSensitiveData(payload)) continue;
        const parsed = envelopeEvent.safeParse(payload);
        if (!parsed.success) continue;
        const event = scrubCrashEvent(parsed.data, {}, route());
        if (event?.event_id) {
          const safeEnvelope: EventEnvelope = [
            { event_id: event.event_id, sent_at: new Date().toISOString() },
            [[{ type: 'event' }, { ...event, release: CRASH_RELEASE, environment: 'production' }]],
          ];
          return inner.send(safeEnvelope);
        }
      }
      return Promise.resolve({});
    },
    flush: timeout => inner.flush(timeout),
  };
}
