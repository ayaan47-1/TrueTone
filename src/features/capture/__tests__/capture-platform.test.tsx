import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
const mockPermission = jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn() }));
const mockFrameMetrics = jest.fn(() => ({ metrics: {}, lumaOutput: null }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => mockPermission(),
  useCameraDevice: () => null,
  usePhotoOutput: () => ({ capturePhoto: jest.fn() }),
  Camera: () => null,
}));
jest.mock('../use-frame-metrics', () => ({ useFrameMetrics: () => mockFrameMetrics() }));
import { Capture } from '../Capture';

test('unsupported Android shows a clear exit without starting camera or detector hooks', async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  try {
    const onCaptured = jest.fn();
    const onCancel = jest.fn();
    const view = await render(<Capture onCaptured={onCaptured} onCancel={onCancel} devForceCapture />);
    expect(view.getByText('Not supported on this device yet')).toBeTruthy();
    expect(mockPermission).not.toHaveBeenCalled();
    expect(mockFrameMetrics).not.toHaveBeenCalled();
    expect(onCaptured).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText('Go back'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    view.unmount();
  } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); }
});
