import { act, fireEvent, render } from '@testing-library/react-native';
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

// NativeWind's css-interop wraps Pressable and treats `style` as a style object: a
// ({ pressed }) => [...] callback has no own keys, so it is silently dropped on device and
// the pill height/radius/centering/ghost border never apply. Style must be static.
describe('PrimaryButton — style survives the NativeWind interop', () => {
  test.each(VARIANTS)('%s variant passes a static (non-function) style', async (variant) => {
    // The host view only ever sees Pressable's resolved style, so inspect the element
    // PrimaryButton hands to Pressable (calling it inside a component keeps hooks legal).
    let element: { props: { style?: unknown } } | null = null;
    function Probe() {
      element = PrimaryButton({ label: 'Continue', variant, onPress: () => {} }) as never;
      return element as never;
    }
    await render(<Probe />);
    expect(element).not.toBeNull();
    expect(typeof element!.props.style).not.toBe('function');
  });

  test('ghost variant keeps its visible hairline border', async () => {
    const view = await render(<PrimaryButton label="Skip" variant="ghost" onPress={() => {}} />);
    const style = flatten(view.getByRole('button').props.style);
    expect(style.borderWidth as number).toBeGreaterThan(0);
    expect(style.borderRadius).toBe(20);
    expect(style.height).toBe(56);
  });

  test.each(VARIANTS)('%s variant still dips while pressed and forwards pressIn/pressOut', async (variant) => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const view = await render(
      <PrimaryButton label="Continue" variant={variant} onPress={() => {}} onPressIn={onPressIn} onPressOut={onPressOut} />,
    );
    const scaleOf = () =>
      (flatten(view.getByRole('button').props.style).transform as { scale: number }[] | undefined)?.[0]?.scale ?? 1;
    const opacityOf = () => flatten(view.getByRole('button').props.style).opacity as number;
    const restOpacity = opacityOf();
    await act(async () => fireEvent(view.getByRole('button'), 'pressIn'));
    expect(onPressIn).toHaveBeenCalled();
    expect(scaleOf() < 1 || opacityOf() < restOpacity).toBe(true);
    await act(async () => fireEvent(view.getByRole('button'), 'pressOut'));
    expect(onPressOut).toHaveBeenCalled();
    expect(scaleOf()).toBe(1);
    expect(opacityOf()).toBe(restOpacity);
  });
});
