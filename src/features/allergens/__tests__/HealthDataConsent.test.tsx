import { render, fireEvent, waitFor } from '@testing-library/react-native';
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
import { HealthDataConsent } from '../HealthDataConsent';
import { ALLERGEN_COPY as C } from '../../../content/allergen-copy';

beforeEach(() => mockRpc.mockReset());

test('shows the consent text and the disclaimer', async () => {
  const v = await render(<HealthDataConsent onConsented={jest.fn()} onDecline={jest.fn()} />);
  expect(v.getByText(C.consent.body)).toBeTruthy();
  expect(v.getByText(C.disclaimer)).toBeTruthy();
});

test('confirm is disabled until "I agree" is ticked (same gate as Consent.tsx)', async () => {
  const onConsented = jest.fn();
  const v = await render(<HealthDataConsent onConsented={onConsented} onDecline={jest.fn()} />);
  expect(v.getByTestId('health-consent-submit').props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  expect(mockRpc).not.toHaveBeenCalled();
  await fireEvent.press(v.getByTestId('health-consent-check'));
  expect(v.getByTestId('health-consent-submit').props.accessibilityState).toMatchObject({ disabled: false });
});

test('confirm records the wa_health receipt, then reports consent', async () => {
  mockRpc.mockResolvedValue({ error: null });
  const onConsented = jest.fn();
  const v = await render(<HealthDataConsent onConsented={onConsented} onDecline={jest.fn()} />);
  await fireEvent.press(v.getByTestId('health-consent-check'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(onConsented).toHaveBeenCalled());
  expect(mockRpc).toHaveBeenCalledWith('record_health_data_consent');
});

test('a failed receipt does not report consent and says nothing was saved', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'offline' } });
  const onConsented = jest.fn();
  const v = await render(<HealthDataConsent onConsented={onConsented} onDecline={jest.fn()} />);
  await fireEvent.press(v.getByTestId('health-consent-check'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(v.getByText(C.consent.failed)).toBeTruthy());
  expect(onConsented).not.toHaveBeenCalled();
});

test('decline writes no receipt', async () => {
  const onDecline = jest.fn();
  const v = await render(<HealthDataConsent onConsented={jest.fn()} onDecline={onDecline} />);
  await fireEvent.press(v.getByText(C.consent.decline));
  expect(onDecline).toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('Decline is disabled while the consent RPC is in flight (no decline + late consent race)', async () => {
  let resolve: (v: unknown) => void = () => undefined;
  mockRpc.mockReturnValue(new Promise((r) => { resolve = r; }));
  const onDecline = jest.fn();
  const v = await render(<HealthDataConsent onConsented={jest.fn()} onDecline={onDecline} />);
  await fireEvent.press(v.getByTestId('health-consent-check'));
  void fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() =>
    expect(v.getByTestId('health-consent-decline').props.accessibilityState).toMatchObject({ disabled: true }));
  void fireEvent.press(v.getByTestId('health-consent-decline'));
  expect(onDecline).not.toHaveBeenCalled();
  resolve({ error: null });
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
});
