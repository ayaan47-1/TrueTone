import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AiConsent } from '../AiConsent';

const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

test('shows Draft A optional AI disclosure and requires a separate unchecked choice', async () => {
  const { getByText, getByTestId } = await render(
    <AiConsent onAllowed={jest.fn()} onNotNow={jest.fn()} />,
  );

  expect(getByText('Optional AI routine and chat')).toBeTruthy();
  expect(getByText(/Anthropic does not receive your face photo or your raw numeric scan scores/i)).toBeTruthy();
  expect(getByTestId('ai-consent-submit')).toBeDisabled();
});

test('records a separate AI receipt before enabling chat', async () => {
  const onAllowed = jest.fn();
  const { getByTestId } = await render(
    <AiConsent onAllowed={onAllowed} onNotNow={jest.fn()} />,
  );

  await fireEvent.press(getByTestId('ai-consent-check'));
  await fireEvent.press(getByTestId('ai-consent-submit'));

  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('record_ai_consent'));
  expect(onAllowed).toHaveBeenCalledTimes(1);
});

test('declining optional AI does not record consent', async () => {
  const onNotNow = jest.fn();
  const { getByText } = await render(
    <AiConsent onAllowed={jest.fn()} onNotNow={onNotNow} />,
  );

  fireEvent.press(getByText('Not Now'));

  expect(onNotNow).toHaveBeenCalledTimes(1);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('fails closed when the AI consent receipt cannot be recorded', async () => {
  mockRpc.mockRejectedValueOnce(new Error('offline'));
  const onAllowed = jest.fn();
  const { getByTestId } = await render(
    <AiConsent onAllowed={onAllowed} onNotNow={jest.fn()} />,
  );

  await fireEvent.press(getByTestId('ai-consent-check'));
  await fireEvent.press(getByTestId('ai-consent-submit'));

  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('record_ai_consent'));
  expect(onAllowed).not.toHaveBeenCalled();
});
