import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGate } from '../AgeGate';
import { cameraDemoState, cameraDemoReset } from '../../../lib/camera-demo-profile';

const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
let mockCameraDemo = false;
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ update: mockUpdate }) },
  get CAMERA_DEMO() {
    return mockCameraDemo;
  },
}));
const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

// `@react-native-community/datetimepicker` is auto-mocked via __mocks__/@react-native-community/
// datetimepicker.js (a bare View forwarding every prop, incl. `onChange`). The gate renders the
// picker immediately, so no async reveal wait is needed before interacting. render and fireEvent
// are awaited so React Native Testing Library manages act() itself -- wrapping them in a manual
// act()/renderGate is what produced the overlapping-act cascade.

const DOB_2000 = new Date(2000, 0, 1);
const DOB_2020 = new Date(2020, 0, 1);

async function pickDob(picker: unknown, dob: Date) {
  await fireEvent(picker as never, 'onChange', { type: 'set' }, dob);
}

beforeEach(async () => {
  mockCameraDemo = false;
  mockUpdate.mockClear();
  cameraDemoReset();
  await AsyncStorage.clear();
});

test('passes 18+ by writing only the derived flag; no DOB in any call/log', async () => {
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await pickDob(getByTestId('dob-picker'), DOB_2000);
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(onPass).toHaveBeenCalled());
  expect(mockUpdate).toHaveBeenCalled();
  const payload = JSON.stringify(mockUpdate.mock.calls);
  expect(payload).toContain('is_18_plus');
  expect(payload).not.toContain('2000-01-01'); // DOB never sent
  expect(JSON.stringify(logSpy.mock.calls)).not.toContain('2000-01-01'); // never logged
});

test('persists a user-scoped AsyncStorage verification record with no raw DOB', async () => {
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await pickDob(getByTestId('dob-picker'), DOB_2000);
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(onPass).toHaveBeenCalled());
  const raw = await AsyncStorage.getItem('age-gate:verified:u1');
  expect(JSON.parse(raw as string)).toEqual({ userId: 'u1', verifiedAt: expect.any(String) });
  expect(raw).not.toContain('2000-01-01');
});

test('CAMERA_DEMO: a real 18+ pass flips local state, never touches Supabase', async () => {
  mockCameraDemo = true;
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await pickDob(getByTestId('dob-picker'), DOB_2000);
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(onPass).toHaveBeenCalled());
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(cameraDemoState().is18).toBe(true);
});

test('CAMERA_DEMO: under 18 still blocks -- does not flip local state or persist', async () => {
  mockCameraDemo = true;
  const onPass = jest.fn();
  const { getByTestId, findByText } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await pickDob(getByTestId('dob-picker'), DOB_2020);
  await fireEvent.press(getByTestId('dob-submit'));
  await findByText('Adults only');
  expect(onPass).not.toHaveBeenCalled();
  expect(cameraDemoState().is18).toBe(false);
  expect(await AsyncStorage.getItem('age-gate:verified:u1')).toBeNull();
});

test('a Supabase failure blocks the write -- no local verification, no onPass', async () => {
  mockUpdate.mockReturnValueOnce({ eq: jest.fn().mockResolvedValue({ error: { message: 'down' } }) });
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await pickDob(getByTestId('dob-picker'), DOB_2000);
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  expect(onPass).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('age-gate:verified:u1')).toBeNull();
});

test('calls onPass on mount for an existing verified record for the same user -- no re-prompt', async () => {
  await AsyncStorage.setItem(
    'age-gate:verified:u1',
    JSON.stringify({ userId: 'u1', verifiedAt: '2026-01-01T00:00:00.000Z' }),
  );
  const onPass = jest.fn();
  await render(<AgeGate userId="u1" onPass={onPass} />);
  await waitFor(() => expect(onPass).toHaveBeenCalled());
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('ignores a verified record stored for a different user -- keeps the picker up', async () => {
  await AsyncStorage.setItem(
    'age-gate:verified:other-user',
    JSON.stringify({ userId: 'other-user', verifiedAt: '2026-01-01T00:00:00.000Z' }),
  );
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await waitFor(() => expect(getByTestId('dob-picker')).toBeTruthy());
  expect(onPass).not.toHaveBeenCalled();
});

test('ignores a corrupt stored verification record -- keeps the picker up', async () => {
  await AsyncStorage.setItem('age-gate:verified:u1', 'not-json{{{');
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await waitFor(() => expect(getByTestId('dob-picker')).toBeTruthy());
  expect(onPass).not.toHaveBeenCalled();
});
