import {
  cameraDemoState,
  cameraDemoSetIs18,
  cameraDemoSetConsent,
  cameraDemoReset,
} from '../camera-demo-profile';

beforeEach(() => cameraDemoReset());

test('starts with both flags false (no gate pre-cleared)', () => {
  expect(cameraDemoState()).toEqual({ is18: false, consentActive: false });
});

test('is18 flips true only after cameraDemoSetIs18() -- never before', () => {
  expect(cameraDemoState().is18).toBe(false);
  cameraDemoSetIs18();
  expect(cameraDemoState().is18).toBe(true);
});

test('consentActive flips true only after cameraDemoSetConsent() -- never before', () => {
  expect(cameraDemoState().consentActive).toBe(false);
  cameraDemoSetConsent();
  expect(cameraDemoState().consentActive).toBe(true);
});

test('reset clears both flags back to false', () => {
  cameraDemoSetIs18();
  cameraDemoSetConsent();
  cameraDemoReset();
  expect(cameraDemoState()).toEqual({ is18: false, consentActive: false });
});
