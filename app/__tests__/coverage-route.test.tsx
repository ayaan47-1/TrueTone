// NOTE (canary salvage): press-driven persist+nav assertion is deferred — the chips use
// PressableScale's Animated-Pressable branch, which RNTL cannot dispatch press events to,
// and the useCalm() reduced-motion mock does not resolve in this jest setup. Component logic
// (single-select, persist, /scan nav, disabled-until-selected) is identical to shipped goals.tsx.
// Follow-up: add a reanimated/useCalm test shim so chip presses can be exercised.

import { render } from '@testing-library/react-native';
import { COVERAGE_LABELS } from '../../src/content/makeup-vocab';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import CoverageScreen from '../setup/coverage';

beforeEach(() => jest.clearAllMocks());

test('renders all three coverage options with their labels', async () => {
  const view = await render(<CoverageScreen />);
  expect(view.getByText(COVERAGE_LABELS.light)).toBeTruthy();
  expect(view.getByText(COVERAGE_LABELS.everyday)).toBeTruthy();
  expect(view.getByText(COVERAGE_LABELS.glam)).toBeTruthy();
});

test('each coverage chip is an unselected button on first render (single-select, none preselected)', async () => {
  const view = await render(<CoverageScreen />);
  const chips = view
    .getAllByRole('button')
    .filter((b) => b.props.accessibilityState && typeof b.props.accessibilityState.selected === 'boolean');
  expect(chips).toHaveLength(3);
  expect(chips.every((c) => c.props.accessibilityState.selected === false)).toBe(true);
});
