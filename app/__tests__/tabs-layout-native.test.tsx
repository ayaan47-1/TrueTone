import { render } from '@testing-library/react-native';

// On iOS 26+ the shell uses Expo Router's NATIVE tab bar (UITabBarController → real Liquid
// Glass). This verifies the same four destinations, order, initial tab and sage selection tint.
jest.mock('../../src/components/ui/liquid-glass', () => ({ hasLiquidGlass: () => true }));

const mockTriggers: Array<{ name: string; label?: string; sf?: unknown }> = [];
const mockHost: { props?: Record<string, unknown> } = {};

jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const collect = (children: React.ReactNode) => {
    React.Children.forEach(children, (trigger: React.ReactElement<any>) => {
      const entry: { name: string; label?: string; sf?: unknown } = { name: trigger.props.name };
      React.Children.forEach(trigger.props.children, (child: React.ReactElement<any>) => {
        if (child.type === Label) entry.label = child.props.children;
        if (child.type === Icon) entry.sf = child.props.sf;
      });
      mockTriggers.push(entry);
    });
  };
  const Label = () => null;
  const Icon = () => null;
  const Trigger = Object.assign(() => null, { Label, Icon });
  const NativeTabs = Object.assign(
    ({ children, ...rest }: { children: React.ReactNode }) => {
      mockHost.props = rest;
      collect(children);
      return null;
    },
    { Trigger },
  );
  return { NativeTabs };
});

jest.mock('expo-router', () => ({ Tabs: () => null }));
jest.mock('../../src/components/ui', () => ({ GlassTabBar: () => null }));

import TabsLayout, { unstable_settings } from '../(tabs)/_layout';
import { palette } from '../../src/theme/tokens';

beforeEach(() => {
  mockTriggers.length = 0;
  mockHost.props = undefined;
});

test('renders the four native tabs in bar order with their labels', async () => {
  await render(<TabsLayout />);
  expect(mockTriggers.map((t) => [t.name, t.label])).toEqual([
    ['shop', 'Shop'],
    ['index', 'For You'],
    ['community', 'Community'],
    ['you', 'Account'],
  ]);
});

test('every tab has an SF Symbol with a filled selected variant', async () => {
  await render(<TabsLayout />);
  for (const t of mockTriggers) {
    expect(t.sf).toEqual({ default: expect.any(String), selected: expect.stringMatching(/\.fill$/) });
  }
});

test('selected tint is the locked sage accent and Shop stays the initial tab', async () => {
  await render(<TabsLayout />);
  expect(mockHost.props?.tintColor).toBe(palette.sage);
  expect(unstable_settings.initialRouteName).toBe('shop');
});
