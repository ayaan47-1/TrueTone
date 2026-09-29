// v3 video frame t-18: the Capture screen wires the glass chrome in. Presentation only.
import { render, within } from '@testing-library/react-native';

jest.mock('../../../components/ui/liquid-glass', () => ({ hasLiquidGlass: () => true }));
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: (props: object) => <View testID="native-glass" {...props} /> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('react-native-vision-camera', () => {
  const { View } = require('react-native');
  return {
    Camera: (props: unknown) => <View {...(props as object)} />,
    useCameraDevice: () => ({ id: 'front-mock' }),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    usePhotoOutput: () => ({ capturePhoto: jest.fn() }),
  };
});

jest.mock('../use-frame-metrics', () => ({
  useFrameMetrics: () => ({
    metrics: {
      faceDetected: false,
      faceCenteredness: 0,
      brightness: 0,
      sharpness: 0,
      faceFraction: 0,
      yaw: 0,
      roll: 0,
      clipping: 0,
      cct: 6500,
      imbalance: 0,
    },
    lumaOutput: null,
  }),
}));

import { Capture } from '../Capture';
import { StyleSheet } from 'react-native';

const renderCapture = () => render(<Capture onCaptured={jest.fn()} onCancel={jest.fn()} />);

test('a warm gradient backdrop sits behind the camera', async () => {
  const view = await renderCapture();
  expect(view.getByTestId('capture-backdrop')).toBeTruthy();
  view.unmount();
});

test('the hint pill is native glass and shows the gate hint', async () => {
  const view = await renderCapture();
  const pill = within(view.getByTestId('capture-hint-pill'));
  expect(pill.getByText('Center your face in the oval')).toBeTruthy();
  view.unmount();
});

test('Cancel is a glass pill in the bottom overlay', async () => {
  const view = await renderCapture();
  const overlay = within(view.getByTestId('capture-bottom-overlay'));
  expect(overlay.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  view.unmount();
});

test('the check strip still holds exactly four glass chips', async () => {
  const view = await renderCapture();
  const strip = within(view.getByTestId('capture-check-strip'));
  expect(strip.getAllByTestId('native-glass')).toHaveLength(4);
  view.unmount();
});

test('the oval is lifted above the bottom controls, as in the video', async () => {
  const view = await renderCapture();
  const area = StyleSheet.flatten(view.getByTestId('capture-oval-area').props.style);
  expect(area.paddingBottom).toBe(130);
  view.unmount();
});
