import { render, fireEvent } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import { AppHeader, APP_HEADER_CONTROL_SIZE } from '../AppHeader';

const MIN_TAP_TARGET = 48;
const HEADER_TOP_GAP = 8;

function flatten(style: unknown) {
  return StyleSheet.flatten(style as never) as Record<string, unknown>;
}

function withInsets(top: number) {
  const insets: EdgeInsets = { top, bottom: 0, left: 0, right: 0 };
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
  );
}

describe('AppHeader — safe-area leading/title/trailing contract', () => {
  test('renders the title and exposes a header role labelled by the title', async () => {
    const view = await render(<AppHeader title="Your Data" />);
    expect(view.getByText('Your Data')).toBeTruthy();
    const header = view.getByLabelText('Your Data');
    expect(header.props.accessibilityRole).toBe('header');
  });

  test('accessibilityLabel prop overrides the title as the header name', async () => {
    const view = await render(<AppHeader title="Your Data" accessibilityLabel="Data & privacy" />);
    const header = view.getByLabelText('Data & privacy');
    expect(header.props.accessibilityRole).toBe('header');
  });

  test('title is single-line so it truncates between the slots instead of colliding', async () => {
    const view = await render(<AppHeader title="A very long screen title that must not wrap" />);
    expect(view.getByText('A very long screen title that must not wrap').props.numberOfLines).toBe(1);
  });

  test('onBack renders a default Back button that meets the 48pt tap target', async () => {
    const onBack = jest.fn();
    const view = await render(<AppHeader title="Scan" onBack={onBack} />);
    const back = view.getByLabelText('Back');
    expect(back.props.accessibilityRole).toBe('button');
    const style = flatten(back.props.style);
    expect(style.width as number).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    expect(style.height as number).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('the shared control size is the 48pt minimum', () => {
    expect(APP_HEADER_CONTROL_SIZE).toBe(MIN_TAP_TARGET);
  });

  test('a custom leading slot takes precedence over the default back button', async () => {
    const view = await render(
      <AppHeader title="Scan" onBack={() => {}} leading={<Text>Close</Text>} />,
    );
    expect(view.getByText('Close')).toBeTruthy();
    expect(view.queryByLabelText('Back')).toBeNull();
  });

  test('no leading control renders when neither onBack nor leading is given', async () => {
    const view = await render(<AppHeader title="Today" />);
    expect(view.queryByLabelText('Back')).toBeNull();
    expect(view.queryByRole('button')).toBeNull();
  });

  test('renders trailing slot content', async () => {
    const view = await render(<AppHeader title="Today" trailing={<Text>Edit</Text>} />);
    expect(view.getByText('Edit')).toBeTruthy();
  });

  test('top padding adds the base gap above the safe-area top inset', async () => {
    const view = await render(<AppHeader title="Scan" />, { wrapper: withInsets(44) });
    expect(flatten(view.getByLabelText('Scan').props.style).paddingTop).toBe(44 + HEADER_TOP_GAP);
  });

  test('degrades to just the base gap when no safe-area provider is mounted', async () => {
    const view = await render(<AppHeader title="Scan" />);
    expect(flatten(view.getByLabelText('Scan').props.style).paddingTop).toBe(HEADER_TOP_GAP);
  });
});
