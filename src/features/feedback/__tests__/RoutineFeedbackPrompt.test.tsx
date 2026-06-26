// src/features/feedback/__tests__/RoutineFeedbackPrompt.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockSet = jest.fn();
jest.mock('../../../lib/scans', () => ({ setRoutineFeedback: (...a: unknown[]) => mockSet(...a) }));

import { RoutineFeedbackPrompt } from '../RoutineFeedbackPrompt';

beforeEach(() => mockSet.mockReset());

test('tapping a choice records that feedback for the scan', async () => {
  mockSet.mockResolvedValue(undefined);
  const onDone = jest.fn();
  const { getByText } = await render(<RoutineFeedbackPrompt scanId="scan-9" onDone={onDone} />);
  fireEvent.press(getByText('It helped'));
  await waitFor(() => expect(mockSet).toHaveBeenCalledWith('scan-9', 'helped'));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
});

test('records the chosen value (no change / worse map to the right enum)', async () => {
  mockSet.mockResolvedValue(undefined);
  const { getByText } = await render(<RoutineFeedbackPrompt scanId="s1" />);
  fireEvent.press(getByText('Looks worse'));
  await waitFor(() => expect(mockSet).toHaveBeenCalledWith('s1', 'worse'));
});

test('on failure it does not call onDone and stays usable for retry', async () => {
  mockSet.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);
  const onDone = jest.fn();
  const { getByText } = await render(<RoutineFeedbackPrompt scanId="s1" onDone={onDone} />);
  fireEvent.press(getByText('It helped'));
  await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
  expect(onDone).not.toHaveBeenCalled();
  fireEvent.press(getByText('It helped'));
  await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

test('a rapid double-tap submits only once (ref guard)', async () => {
  let resolve: () => void = () => {};
  mockSet.mockReturnValue(new Promise<void>((r) => { resolve = () => r(); }));
  const { getByText } = await render(<RoutineFeedbackPrompt scanId="s1" />);
  fireEvent.press(getByText('It helped'));
  fireEvent.press(getByText('It helped'));
  expect(mockSet).toHaveBeenCalledTimes(1);
  resolve();
});
