import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import ScanGateScreen from '../scan-gate';

beforeEach(() => jest.clearAllMocks());

test('renders the on-device heading and both actions', async () => {
  const view = await render(<ScanGateScreen />);
  expect(view.getByText('Your scan stays on your device')).toBeTruthy();
  expect(view.getByText('Enable camera')).toBeTruthy();
  expect(view.getByText('Skip for now')).toBeTruthy();
});

test('both actions are matching full-width 56pt pills, spaced 16 apart', async () => {
  const { StyleSheet } = require('react-native');
  const view = await render(<ScanGateScreen />);
  const buttons = view.getAllByRole('button').filter((b) => {
    const s = StyleSheet.flatten(b.props.style) ?? {};
    return s.height === 56;
  });
  expect(buttons).toHaveLength(2);
  for (const b of buttons) {
    const s = StyleSheet.flatten(b.props.style);
    expect(s.alignSelf).toBe('stretch');
    expect(s.width).toBe('100%');
    expect(s.alignItems).toBe('center');
    expect(s.justifyContent).toBe('center');
  }
  expect(view.getByTestId('scan-gate-actions').props.className).toEqual(expect.stringContaining('gap-4'));
});
