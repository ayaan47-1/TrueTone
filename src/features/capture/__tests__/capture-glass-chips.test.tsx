// On iOS 26+ the four floating quality chips over the camera are native Liquid Glass
// (styling only — the quality gate that drives them is untouched).
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

test('the four check chips render as native glass', async () => {
  const view = await render(<Capture onCaptured={jest.fn()} onCancel={jest.fn()} />);
  // Scoped to the check strip: Cancel below it is a glass pill too (v3 design).
  const strip = within(view.getByTestId('capture-check-strip'));
  expect(strip.getAllByTestId('native-glass')).toHaveLength(4);
  view.unmount(); // stop the breathing-glow loop + tick interval started on mount
});
