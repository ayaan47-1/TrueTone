import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Consent } from '../Consent';
import { cameraDemoState, cameraDemoReset } from '../../../lib/camera-demo-profile';

const mockRpc = jest.fn().mockResolvedValue({ data: {}, error: null });
let mockCameraDemo = false;
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
  get CAMERA_DEMO() {
    return mockCameraDemo;
  },
}));

beforeEach(() => {
  mockCameraDemo = false;
  mockRpc.mockClear();
  cameraDemoReset();
});

test('renders BIPA 15(b) disclosures (what/purpose/retention)', async () => {
  const { getAllByText } = await render(<Consent onConsent={jest.fn()} onDecline={jest.fn()} />);
  expect(getAllByText(/biometric/i).length).toBeGreaterThan(0); // WHAT
  expect(getAllByText(/purpose/i).length).toBeGreaterThan(0); // PURPOSE
  expect(getAllByText(/3 years/i).length).toBeGreaterThan(0); // RETENTION
});
test('consent button disabled until box checked, then calls record_consent', async () => {
  const onConsent = jest.fn();
  const { getByTestId } = await render(<Consent onConsent={onConsent} onDecline={jest.fn()} />);
  expect(getByTestId('consent-submit')).toBeDisabled();
  await fireEvent.press(getByTestId('consent-check'));
  expect(getByTestId('consent-submit')).not.toBeDisabled();
  await fireEvent.press(getByTestId('consent-submit'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('record_consent'));
  expect(onConsent).toHaveBeenCalled();
});

test('CAMERA_DEMO: a real affirmative tap flips local state, never touches Supabase', async () => {
  mockCameraDemo = true;
  const onConsent = jest.fn();
  const { getByTestId } = await render(<Consent onConsent={onConsent} onDecline={jest.fn()} />);
  await fireEvent.press(getByTestId('consent-check'));
  await fireEvent.press(getByTestId('consent-submit'));
  await waitFor(() => expect(onConsent).toHaveBeenCalled());
  expect(mockRpc).not.toHaveBeenCalled();
  expect(cameraDemoState().consentActive).toBe(true);
});

test('CAMERA_DEMO: still requires the checkbox tap against the real disclosure copy first', async () => {
  mockCameraDemo = true;
  const { getByTestId } = await render(<Consent onConsent={jest.fn()} onDecline={jest.fn()} />);
  expect(getByTestId('consent-submit')).toBeDisabled();
});
