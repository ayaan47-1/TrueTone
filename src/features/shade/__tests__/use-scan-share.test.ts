import { renderHook, act } from '@testing-library/react-native';
import { useScanShare } from '../use-scan-share';

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

// A minimal object shape for shareCardRef.current -- useScanShare only checks truthiness
// before capturing; the real capture target is a native View ref in the app.
const fakeViewHandle = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue('file:///tmp/scan-share-card.png');
  mockShareAsync.mockResolvedValue(undefined);
});

test('one Share call captures the card once and shares exactly one local image file', async () => {
  const { result } = await renderHook(() => useScanShare());
  result.current.shareCardRef.current = fakeViewHandle;

  await act(async () => {
    await result.current.share();
  });

  expect(mockCaptureRef).toHaveBeenCalledTimes(1);
  expect(mockShareAsync).toHaveBeenCalledTimes(1);
  const [uri, options] = mockShareAsync.mock.calls[0];
  expect(uri).toBe('file:///tmp/scan-share-card.png');
  expect(options).toMatchObject({ mimeType: 'image/png' });
});

test('does not share when the OS share sheet is unavailable', async () => {
  mockIsAvailableAsync.mockResolvedValue(false);
  const { result } = await renderHook(() => useScanShare());
  result.current.shareCardRef.current = fakeViewHandle;

  await act(async () => {
    await result.current.share();
  });

  expect(mockCaptureRef).not.toHaveBeenCalled();
  expect(mockShareAsync).not.toHaveBeenCalled();
  expect(result.current.status).toBe('unavailable');
});

test('a share-sheet cancel/failure resolves without throwing', async () => {
  mockShareAsync.mockRejectedValue(new Error('user cancelled'));
  const { result } = await renderHook(() => useScanShare());
  result.current.shareCardRef.current = fakeViewHandle;

  await act(async () => {
    await result.current.share();
  });
  expect(result.current.status).toBe('error');
});

test('a capture failure resolves without throwing and does not open the share sheet', async () => {
  mockCaptureRef.mockRejectedValue(new Error('capture failed'));
  const { result } = await renderHook(() => useScanShare());
  result.current.shareCardRef.current = fakeViewHandle;

  await act(async () => {
    await result.current.share();
  });

  expect(mockShareAsync).not.toHaveBeenCalled();
  expect(result.current.status).toBe('error');
});

test('does nothing when the card has not mounted yet', async () => {
  const { result } = await renderHook(() => useScanShare());

  await act(async () => {
    await result.current.share();
  });

  expect(mockCaptureRef).not.toHaveBeenCalled();
  expect(mockShareAsync).not.toHaveBeenCalled();
  expect(result.current.status).toBe('error');
});
