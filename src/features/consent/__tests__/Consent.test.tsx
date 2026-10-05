import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Consent } from '../Consent';
import { LEGAL_ENTITY_NAME } from '../consent-copy';
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

test('renders the counsel-provided consent text verbatim with the I Agree action', async () => {
  const { getByText, getByTestId } = await render(
    <Consent onConsent={jest.fn()} onDecline={jest.fn()} />,
  );

  expect(LEGAL_ENTITY_NAME).toBe('[True Tone legal entity name]');
  expect(getByText('Consent to Collection of Skin-Scan Data')).toBeTruthy();
  expect(
    getByText(
      'To use True Tone you will need to provide an electronic image of your face. To proceed with True Tone, click "I Agree" below.',
    ),
  ).toBeTruthy();
  expect(
    getByText(
      `I authorize ${LEGAL_ENTITY_NAME} (and/or a software service provider acting on True Tone's behalf) to collect and process data derived from a scan of my photograph of my face ("Skin-Scan Data"). I understand that the Skin-Scan Data may include measurements relating to facial features, and that some may contend that this information is biometric.`,
    ),
  ).toBeTruthy();
  expect(
    getByText(
      "I understand that any Skin-Scan Data will not be retained by True Tone or True Tone's software service provider after I navigate away from this webpage or close the True Tone app. I understand that I have the option to save my Skin-Scan results to my preferences in my True Tone account, and that I can change those preferences at any time in my account.",
    ),
  ).toBeTruthy();
  expect(
    getByText(
      'I am providing my consent voluntarily, and I understand that I may withdraw my consent by navigating outside of True Tone within the True Tone mobile application.',
    ),
  ).toBeTruthy();
  expect(
    getByText(
      'By providing my consent, I represent that I am not an Illinois resident, and I am not using this tool while in Illinois.',
    ),
  ).toBeTruthy();
  expect(getByTestId('consent-submit')).toHaveTextContent('I Agree');
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
