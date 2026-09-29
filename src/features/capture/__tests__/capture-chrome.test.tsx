// Scan screen chrome (v3 video frame t-18): warm dark backdrop, a Liquid Glass hint pill and a
// Liquid Glass Cancel pill. Presentation only — the quality gate and capture logic are untouched.
import { fireEvent, render, within } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';

jest.mock('../../../components/ui/liquid-glass', () => ({ hasLiquidGlass: () => true }));
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: (props: object) => <View testID="native-glass" {...props} /> };
});

import { CaptureBackdrop, GlassCancelButton, GlassHintPill } from '../CaptureChrome';

test('the backdrop is a warm dark gradient, not a flat black', async () => {
  const view = await render(<CaptureBackdrop />);
  const backdrop = view.getByTestId('capture-backdrop');
  expect(backdrop.props.colors).toEqual(['#1a1714', '#3a322b', '#111111'].map((c) => processColor(c)));
});

test('the hint pill is native glass and shows the hint', async () => {
  const view = await render(<GlassHintPill text="Center your face in the oval" pass={false} />);
  const pill = view.getByTestId('capture-hint-pill');
  expect(within(pill).getByText('Center your face in the oval')).toBeTruthy();
  expect(pill.props.glassEffectStyle).toBe('regular');
});

test('the hint pill takes a sage tint once every check passes', async () => {
  const view = await render(<GlassHintPill text="Looking good — hold still" pass />);
  expect(view.getByTestId('capture-hint-pill').props.tintColor).toBe('rgba(47,125,82,0.35)');
});

test('the cancel pill is native glass and calls onPress', async () => {
  const onPress = jest.fn();
  const view = await render(<GlassCancelButton onPress={onPress} disabled={false} />);
  expect(view.getAllByTestId('native-glass')).toHaveLength(1);
  fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('the cancel pill is dimmed and inert while disabled (countdown)', async () => {
  const onPress = jest.fn();
  const view = await render(<GlassCancelButton onPress={onPress} disabled />);
  fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(onPress).not.toHaveBeenCalled();
  const color = StyleSheet.flatten(view.getByText('Cancel').props.style).color;
  expect(color).toBe('rgba(255,255,255,0.35)');
});
