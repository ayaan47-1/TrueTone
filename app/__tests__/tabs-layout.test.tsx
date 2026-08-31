import { render, fireEvent } from '@testing-library/react-native';

// The center "Shade match" action MUST route through the pre-camera gate route
// (`/scan-gate`), never straight to the camera (`/scan`). Age-gate + biometric
// consent are enforced upstream by the root Guard before `(tabs)` is reachable
// (CLAUDE.md §1); scan-gate is the on-device-privacy screen shown before capture.
const mockPush = jest.fn();

jest.mock('expo-router', () => {
  // A minimal <Tabs> that immediately renders the supplied tabBar with a fake
  // navigation state (Shop focused), so the layout's route adapter runs.
  const Tabs = Object.assign(
    ({ tabBar }: { tabBar: (props: unknown) => React.ReactElement }) =>
      tabBar({
        state: { index: 0, routes: [{ name: 'shop', key: 'shop' }] },
        navigation: {
          emit: () => ({ defaultPrevented: false }),
          navigate: jest.fn(),
        },
      }),
    { Screen: () => null },
  );
  return {
    Tabs,
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  };
});

// Capture the onScanPress wiring behind a pressable we can fire.
jest.mock('../../src/components/ui', () => {
  const { Pressable, Text } = require('react-native');
  return {
    GlassTabBar: ({ onScanPress }: { onScanPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="Shade match" onPress={onScanPress}>
        <Text>Shade match</Text>
      </Pressable>
    ),
  };
});

import TabsLayout from '../(tabs)/_layout';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.clearAllMocks());

test('the Shade match button routes through the /scan-gate entry', async () => {
  const view = await render(<TabsLayout />);
  fireEvent.press(view.getByRole('button', { name: 'Shade match' }));
  expect(mockPush).toHaveBeenCalledWith('/scan-gate');
  await flush();
});

test('the Shade match button never opens the camera (/scan) directly', async () => {
  const view = await render(<TabsLayout />);
  fireEvent.press(view.getByRole('button', { name: 'Shade match' }));
  expect(mockPush).not.toHaveBeenCalledWith('/scan');
  expect(mockPush).not.toHaveBeenCalledWith('/scan-entry');
  await flush();
});
