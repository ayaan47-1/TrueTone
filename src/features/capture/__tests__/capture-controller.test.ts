// src/features/capture/__tests__/capture-controller.test.ts
import {
  captureReducer, initialCaptureState, countdownSeconds,
  HOLD_REQUIRED_MS, COUNTDOWN_MS,
} from '../capture-controller';

function run(events: Array<{ dtMs: number; allPass: boolean }>) {
  return events.reduce((s, e) => captureReducer(s, { type: 'tick', ...e }), initialCaptureState);
}

test('aligned hold advances idle -> holding -> countdown -> captured', () => {
  const afterHold = run([
    { dtMs: 0, allPass: true },                  // idle -> holding
    { dtMs: HOLD_REQUIRED_MS, allPass: true },   // holding -> countdown
  ]);
  expect(afterHold.phase).toBe('countdown');
  const captured = captureReducer(afterHold, { type: 'tick', dtMs: COUNTDOWN_MS, allPass: true });
  expect(captured.phase).toBe('captured');
});
test('losing alignment mid-hold resets to idle', () => {
  const s = run([{ dtMs: 0, allPass: true }, { dtMs: 500, allPass: true }, { dtMs: 16, allPass: false }]);
  expect(s).toEqual(initialCaptureState);
});
test('captured is terminal (no double-fire)', () => {
  let s = run([{ dtMs: 0, allPass: true }, { dtMs: HOLD_REQUIRED_MS, allPass: true }]);
  s = captureReducer(s, { type: 'tick', dtMs: COUNTDOWN_MS, allPass: true });
  const again = captureReducer(s, { type: 'tick', dtMs: COUNTDOWN_MS, allPass: true });
  expect(again).toBe(s);
});
test('reset returns to idle from any phase', () => {
  const s = run([{ dtMs: 0, allPass: true }]);
  expect(captureReducer(s, { type: 'reset' })).toEqual(initialCaptureState);
});
test('countdownSeconds counts down 3..1', () => {
  let s = run([{ dtMs: 0, allPass: true }, { dtMs: HOLD_REQUIRED_MS, allPass: true }]);
  expect(countdownSeconds(s)).toBe(3);
  s = captureReducer(s, { type: 'tick', dtMs: 1000, allPass: true });
  expect(countdownSeconds(s)).toBe(2);
});
