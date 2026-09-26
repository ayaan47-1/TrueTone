import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ShadeMatchResult } from '../ShadeMatchResult';
import type { CurrentShade } from '../shade-types';

const mockCaptureRef = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 5, finish: 'satin' };

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue('file:///tmp/scan-share-card.png');
  mockShareAsync.mockResolvedValue(undefined);
});

test('one Share press produces exactly one local image-file share request', async () => {
  const onShare = jest.fn();
  const view = await render(<ShadeMatchResult shade={shade} onShare={onShare} />);

  fireEvent.press(view.getByText('Share'));

  await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(1));
  expect(mockCaptureRef).toHaveBeenCalledTimes(1);
  const [uri, options] = mockShareAsync.mock.calls[0];
  expect(uri).toBe('file:///tmp/scan-share-card.png');
  expect(options).toMatchObject({ mimeType: 'image/png' });
  expect(onShare).toHaveBeenCalledTimes(1);
});

test('a share failure does not crash the result screen', async () => {
  mockShareAsync.mockRejectedValue(new Error('share failed'));
  const view = await render(<ShadeMatchResult shade={shade} />);

  fireEvent.press(view.getByText('Share'));

  await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(1));
  expect(view.getByText('Share')).toBeTruthy();
});
