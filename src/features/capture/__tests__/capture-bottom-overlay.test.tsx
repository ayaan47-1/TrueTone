// src/features/capture/__tests__/capture-bottom-overlay.test.tsx
//
// Layout regression guard: the check chips, privacy line, shutter and cancel button must live in
// ONE bottom overlay in normal flow, not two independently bottom-positioned views. Two absolute
// siblings guessing each other's height (a hardcoded pixel gap) could collide on a short or
// notched screen; this asserts there is a single `capture-bottom-overlay` container and that every
// bottom-of-screen element is its descendant, so the layout engine (not a magic number) owns the
// spacing between them.
import { render, within } from '@testing-library/react-native';

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

test('every bottom-of-screen element sits inside one bottom overlay container', async () => {
  const view = await render(
    <Capture onCaptured={jest.fn()} onCancel={jest.fn()} />,
  );

  const overlay = view.getByTestId('capture-bottom-overlay');
  const scoped = within(overlay);

  // check chips
  expect(scoped.getByText('Face')).toBeTruthy();
  expect(scoped.getByText('Light')).toBeTruthy();
  expect(scoped.getByText('Framing')).toBeTruthy();
  expect(scoped.getByText('Focus')).toBeTruthy();
  // privacy reassurance + cancel, formerly a second, independently bottom-positioned view
  expect(scoped.getByText('Natural light works best')).toBeTruthy();
  expect(
    scoped.getByText('Analyzed on your device · never leaves your phone · deleted after your read'),
  ).toBeTruthy();
  expect(scoped.getByText('Cancel')).toBeTruthy();

  // exactly one bottom overlay in the tree -- not a second, independently positioned sibling
  expect(view.getAllByTestId('capture-bottom-overlay')).toHaveLength(1);

  view.unmount(); // stop the breathing-glow loop + tick interval started on mount
});
