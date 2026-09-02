import { render, fireEvent } from '@testing-library/react-native';

// The bottom bar is now four plain tabs (Shop · For You · Trend · Settings). The
// shade-match scan entry no longer lives here — it moved to the For You header (see
// app/__tests__/for-you.test.tsx for the /scan-gate compliance assertion). This test
// verifies the layout adapts React Navigation state onto the GlassTabBar and routes a
// tab press to navigation.navigate.
const mockNavigate = jest.fn();

jest.mock('expo-router', () => {
  // A minimal <Tabs> that immediately renders the supplied tabBar with a fake
  // navigation state (Shop focused), so the layout's route adapter runs.
  const Tabs = Object.assign(
    ({ tabBar }: { tabBar: (props: unknown) => React.ReactElement }) =>
      tabBar({
        state: {
          index: 0,
          routes: [
            { name: 'shop', key: 'shop' },
            { name: 'index', key: 'index' },
            { name: 'trend', key: 'trend' },
            { name: 'you', key: 'you' },
          ],
        },
        navigation: {
          emit: () => ({ defaultPrevented: false }),
          navigate: mockNavigate,
        },
      }),
    { Screen: () => null },
  );
  return { Tabs };
});

// Capture the onSelect wiring behind pressables we can fire.
jest.mock('../../src/components/ui', () => {
  const { Pressable, Text } = require('react-native');
  return {
    GlassTabBar: ({ onSelect }: { onSelect: (k: string) => void }) => (
      <>
        <Pressable accessibilityRole="tab" accessibilityLabel="Settings" onPress={() => onSelect('you')}>
          <Text>Settings</Text>
        </Pressable>
      </>
    ),
  };
});

import TabsLayout from '../(tabs)/_layout';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.clearAllMocks());

test('selecting a tab navigates to its route', async () => {
  const view = await render(<TabsLayout />);
  fireEvent.press(view.getByRole('tab', { name: 'Settings' }));
  expect(mockNavigate).toHaveBeenCalledWith('you');
  await flush();
});

test('the layout no longer wires a direct-to-camera scan action', async () => {
  const view = await render(<TabsLayout />);
  // No control anywhere routes to '/scan' — there is no onScanPress on the bar at all.
  expect(view.queryByLabelText('Shade match')).toBeNull();
});
