import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// GlassSurface = Apple's native Liquid Glass (expo-glass-effect GlassView) on iOS 26+, else the
// Quiet Glass BlurView + fill fallback. Used for floating CONTROLS only, never content cards.
const mockEnv = { liquid: true };
jest.mock('../liquid-glass', () => ({ hasLiquidGlass: () => mockEnv.liquid }));
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: (props: object) => <View testID="native-glass" {...props} /> };
});
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: (props: object) => <View testID="fallback-blur" {...props} /> };
});

import { GlassSurface } from '../GlassSurface';

const FILL = { backgroundColor: 'rgba(255,255,255,0.82)' };

beforeEach(() => {
  mockEnv.liquid = true;
});

test('renders native interactive glass with its tint when Liquid Glass is available', async () => {
  const view = await render(
    <GlassSurface style={{ borderRadius: 24 }} tintColor="#2f7d52" interactive fallbackStyle={FILL}>
      <Text>child</Text>
    </GlassSurface>,
  );
  const glass = view.getByTestId('native-glass');
  expect(glass.props.isInteractive).toBe(true);
  expect(glass.props.tintColor).toBe('#2f7d52');
  expect(glass.props.glassEffectStyle).toBe('regular');
  expect(glass).toHaveStyle({ borderRadius: 24 });
  // The fallback fill must not tint over the real glass.
  expect(glass).not.toHaveStyle(FILL);
  expect(view.queryByTestId('fallback-blur')).toBeNull();
  expect(view.getByText('child')).toBeTruthy();
});

test('falls back to BlurView + fill when Liquid Glass is unavailable', async () => {
  mockEnv.liquid = false;
  const view = await render(
    <GlassSurface testID="surface" style={{ borderRadius: 24 }} fallbackStyle={FILL}>
      <Text>child</Text>
    </GlassSurface>,
  );
  expect(view.queryByTestId('native-glass')).toBeNull();
  expect(view.getByTestId('fallback-blur')).toBeTruthy();
  expect(view.getByTestId('surface')).toHaveStyle({ borderRadius: 24, ...FILL, overflow: 'hidden' });
  expect(view.getByText('child')).toBeTruthy();
});

test('intensity 0 keeps the fallback fill-only (no blur layer)', async () => {
  mockEnv.liquid = false;
  const view = await render(<GlassSurface intensity={0} fallbackStyle={FILL} />);
  expect(view.queryByTestId('fallback-blur')).toBeNull();
});
