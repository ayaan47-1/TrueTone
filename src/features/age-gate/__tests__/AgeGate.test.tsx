import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

beforeEach(() => {
  mockCameraDemo = false;
  mockUpdate.mockClear();
  cameraDemoReset();
});

test('passes 18+ by writing only the derived flag; no DOB in any call/log', async () => {
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={jest.fn()} />);
  await fireEvent.changeText(getByTestId('dob-input'), '2000-01-01');
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  const payload = JSON.stringify(mockUpdate.mock.calls);
  expect(payload).toContain('is_18_plus');
  expect(payload).not.toContain('2000-01-01'); // DOB never sent
  expect(JSON.stringify(logSpy.mock.calls)).not.toContain('2000-01-01'); // never logged
});

test('CAMERA_DEMO: a real 18+ pass flips local state, never touches Supabase', async () => {
  mockCameraDemo = true;
  const onPass = jest.fn();
  const { getByTestId } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await fireEvent.changeText(getByTestId('dob-input'), '2000-01-01');
  await fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(onPass).toHaveBeenCalled());
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(cameraDemoState().is18).toBe(true);
});

test('CAMERA_DEMO: under 18 still blocks -- does not flip local state', async () => {
  mockCameraDemo = true;
  const onPass = jest.fn();
  const { getByTestId, findByText } = await render(<AgeGate userId="u1" onPass={onPass} />);
  await fireEvent.changeText(getByTestId('dob-input'), '2020-01-01');
  await fireEvent.press(getByTestId('dob-submit'));
  await findByText('Adults only');
  expect(onPass).not.toHaveBeenCalled();
  expect(cameraDemoState().is18).toBe(false);
});
