import type { Breadcrumb, ErrorEvent, Event, EventHint, StackFrame, Transport, EventEnvelope } from '@sentry/core';
import { z } from 'zod';
import app from '../../../app.json';

export const CRASH_RELEASE = `truetone@${app.expo.version}`;

const SAFE_ROUTES = new Set(['/', '/shop', '/shop-bag', '/bag', '/community', '/you']);
const BUNDLE_NAMES = new Set(['index.android.bundle', 'index.ios.bundle', 'index.bundle', 'main.jsbundle', 'main.js', 'index.js']);
const ERROR_TYPES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError']);
const SENSITIVE_SOURCE = /(?:features[\\/](?:capture|read|shade|match)|app[\\/]scan|bbox-overlay)/i;

function isReportableRoute(route: string): boolean {
  return SAFE_ROUTES.has(route) || /^\/shop-product\/[^/?#]+$/.test(route);
}

function scrubFrame(frame: StackFrame): StackFrame | null {
  const filename = frame.filename?.split(/[?#]/, 1)[0].split(/[\\/]/).pop();
  if (!filename || !BUNDLE_NAMES.has(filename)) return null;
  return {
    filename,
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
  if (!isReportableRoute(route) || event.type || !event.exception?.values?.length) return null;
  if (event.exception.values.some(value => value.stacktrace?.frames?.some(frame => SENSITIVE_SOURCE.test(frame.filename ?? '')))) return null;
  const values = event.exception.values.slice(0, 4).flatMap(value => {
    const frames = (value.stacktrace?.frames ?? []).slice(-60).flatMap(frame => {
      const safe = scrubFrame(frame);
      return safe ? [safe] : [];
    });
    if (!frames.length) return [];
    return [{ type: ERROR_TYPES.has(value.type ?? '') ? value.type : 'Error', value: 'Crash details redacted', stacktrace: { frames } }];
  });
  if (!values.length) return null;
  return {
    type: undefined, platform: 'javascript', level: event.level === 'fatal' ? 'fatal' : 'error', exception: { values },
    ...(event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
  };
}

const envelopeEvent = z.object({
  type: z.literal('transaction').optional(),
  event_id: z.string().optional(), timestamp: z.number().optional(),
  level: z.enum(['fatal','error','warning','info','debug']).optional(),
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
