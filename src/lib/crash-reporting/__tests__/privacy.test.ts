import type { ErrorEvent, EventHint } from '@sentry/core';
import { scrubCrashEvent, scrubCrashBreadcrumb } from '../privacy';

const sensitiveCrash: ErrorEvent = {
  type: undefined,
  level: 'error',
  exception: { values: [{ type: 'TypeError', value: 'jane@example.com user-123 warm olive 0.8',
    stacktrace: { frames: [{ filename: 'app:///index.android.bundle?email=jane@example.com', function: 'user-123', lineno: 17, colno: 9, vars: { scores: 0.8 } }] } }] },
  message: 'skinType=combination', user: { id: 'user-123', email: 'jane@example.com' },
  request: { url: 'https://example.test/?token=private', headers: { Authorization: 'secret' } },
  extra: { scores: { hydration: 0.8 }, skinType: 'dry', shade: 'olive', match: 0.98, routine: ['private'] },
  contexts: { skin: { scores: 0.8 } }, tags: { userId: 'user-123' },
  breadcrumbs: [{ message: 'private routine' }], transaction: '/scan/result?user=user-123',
};
const crash: ErrorEvent = { type:undefined, level:'error', exception:{values:[{type:'TypeError',value:'Unexpected state',stacktrace:{frames:[{filename:'app:///index.android.bundle',lineno:17,colno:9}]}}]} };

test('rebuilds a technical error and clears attachments', () => {
  const hint: EventHint = { attachments: [{ filename: 'face.jpg', data: 'secret image' }] };
  expect(scrubCrashEvent(crash, hint, '/shop')).toEqual({
    platform: 'javascript', level: 'error',
    sdk: { name:'sentry.javascript.react-native',version:'8.35.0',settings:{infer_ip:'never'} },
    exception: { values: [{ type: 'TypeError', value: 'Crash details redacted',
      stacktrace: { frames: [{ filename: 'index.android.bundle', lineno: 17, colno: 9 }] } }] },
  });
  expect(hint.attachments).toEqual([]);
  expect(sensitiveCrash.user?.email).toBe('jane@example.com');
});

test.each(['/', '/you', '/community', '/scan', '/scan/result', '/scan/chat', '/scan-gate', '/scan-history/123', '/routine', '/shade-feedback', '/(dev)/bbox-overlay', '/unknown', ''])('drops events on sensitive or unknown route %s', route => {
  expect(scrubCrashEvent(crash, {}, route)).toBeNull();
});

test.each(['src/features/capture/Capture.tsx', 'src/features/read/cv.ts', 'app/scan/index.tsx'])('drops delayed scan errors with stack frame %s even after leaving scan', filename => {
  expect(scrubCrashEvent({ ...crash, exception: { values: [{ stacktrace: { frames: [{ filename }] } }] } }, {}, '/shop')).toBeNull();
});

test('drops messages, transactions, and crashes without a usable stack', () => {
  expect(scrubCrashEvent({ message: 'private message' }, {}, '/shop')).toBeNull();
  expect(scrubCrashEvent({ ...crash, type: 'transaction' }, {}, '/shop')).toBeNull();
  expect(scrubCrashEvent({ exception: { values: [{ value: 'secret' }] } }, {}, '/shop')).toBeNull();
});

test('discards every breadcrumb, including network, console, and camera data', () => {
  for (const category of ['console', 'http', 'navigation', 'camera']) {
    expect(scrubCrashBreadcrumb({ category, message: 'jane@example.com', data: { scores: 0.8 } })).toBeNull();
  }
});

test('rejects raw sensitive strings in exception types, paths or frame locals', () => {
  expect(scrubCrashEvent({ exception: { values: [{ type: 'private-user', value: 'secret', stacktrace: { frames: [
    { filename: 'https://example.test/users/jane@example.com?token=secret', function: 'secret', lineno: 3 },
    { filename: 'app:///main.js#secret', lineno: 4, colno: 5, pre_context: ['secret'] },
  ] } }] } }, {}, '/shop')).toBeNull();
});

test('rebuilds the SDK IP-inference block from constants rather than trusting incoming SDK data', () => {
  const event = scrubCrashEvent({ ...crash, sdk: { name:'untrusted.sdk', version:'0', settings:{infer_ip:'auto'} } }, {}, '/shop');
  expect(event?.sdk).toEqual({ name:'sentry.javascript.react-native', version:'8.35.0', settings:{infer_ip:'never'} });
});

test('rejects the entire raw event when personal or cosmetic data appears anywhere', () => {
  expect(scrubCrashEvent(sensitiveCrash, {}, '/shop')).toBeNull();
});

test.each([
  {message:'shade score for account 123'}, {extra:{skinType:'dry'}}, {contexts:{nested:{rawLab:[1,2,3]}}},
  {extra:{opaque:'jane@example.com'}}, {exception:{values:[{value:'routine recommendation'}]}},
  {extra:{faceVertices:[1,2,3]}}, {extra:{healthStatus:'unknown'}}, {extra:{depth_band:6}}, {extra:{lab:[1,2,3]}},
])('raw sensitive canary fails closed before reconstruction: %j', data => {
  expect(scrubCrashEvent({...crash,...data},{},'/shop')).toBeNull();
});
