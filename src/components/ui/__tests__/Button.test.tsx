import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PrimaryButton } from '../Button';

const MIN_TAP_TARGET = 48;
const VARIANTS = ['primary', 'glass', 'ghost'] as const;

function flatten(style: unknown) {
  return StyleSheet.flatten(style as never) as Record<string, unknown>;
}

describe('PrimaryButton — shared tap-target/padding/full-width contract', () => {
  test.each(VARIANTS)('%s variant meets the 48pt minimum tap target', async (variant) => {
    const view = await render(<PrimaryButton label="Continue" variant={variant} onPress={() => {}} />);
    const style = flatten(view.getByRole('button').props.style);
    expect(style.height as number).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  test.each(VARIANTS)('%s variant shares the same 24pt horizontal padding', async (variant) => {
    const view = await render(<PrimaryButton label="Continue" variant={variant} onPress={() => {}} />);
    const style = flatten(view.getByRole('button').props.style);
    expect(style.paddingHorizontal).toBe(24);
  });

  test.each(VARIANTS)('%s variant renders its label at the shared 15px size', async (variant) => {
    const view = await render(<PrimaryButton label="Continue" variant={variant} onPress={() => {}} />);
    expect(view.getByText('Continue').props.className).toEqual(expect.stringContaining('text-[15px]'));
  });

  test('primary and glass labels use the prominent (semibold) weight; ghost stays quiet (medium)', async () => {
    const primary = await render(<PrimaryButton label="Continue" variant="primary" onPress={() => {}} />);
    const glass = await render(<PrimaryButton label="Continue" variant="glass" onPress={() => {}} />);
    const ghost = await render(<PrimaryButton label="Continue" variant="ghost" onPress={() => {}} />);

    expect(primary.getByText('Continue').props.className).toEqual(expect.stringContaining('font-semibold'));
    expect(glass.getByText('Continue').props.className).toEqual(expect.stringContaining('font-body-semibold'));
    expect(ghost.getByText('Continue').props.className).toEqual(expect.stringContaining('font-body-medium'));
  });

  test.each(VARIANTS)('%s variant stretches to fill its row when fullWidth is set', async (variant) => {
    const view = await render(<PrimaryButton label="Continue" variant={variant} fullWidth onPress={() => {}} />);
    const style = flatten(view.getByRole('button').props.style);
    expect(style.alignSelf).toBe('stretch');
    expect(style.width).toBe('100%');
  });

  test.each(VARIANTS)('%s variant does not stretch by default', async (variant) => {
    const view = await render(<PrimaryButton label="Continue" variant={variant} onPress={() => {}} />);
    const style = flatten(view.getByRole('button').props.style);
    expect(style.alignSelf).toBeUndefined();
  });
});
