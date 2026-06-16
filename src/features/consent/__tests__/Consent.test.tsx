import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Consent } from '../Consent';

const mockRpc = jest.fn().mockResolvedValue({ data: {}, error: null });
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

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
