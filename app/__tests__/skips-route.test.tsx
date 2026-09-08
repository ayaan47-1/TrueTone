import { render } from '@testing-library/react-native';
import { SKIP_LABELS } from '../../src/content/makeup-vocab';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import SkipsScreen from '../setup/skips';

beforeEach(() => jest.clearAllMocks());

test('renders all four skip options with their labels', async () => {
  const view = await render(<SkipsScreen />);
  expect(view.getByText(SKIP_LABELS.fragrance)).toBeTruthy();
  expect(view.getByText(SKIP_LABELS.heavy_shimmer)).toBeTruthy();
  expect(view.getByText(SKIP_LABELS.full_coverage)).toBeTruthy();
  expect(view.getByText(SKIP_LABELS.drying_matte)).toBeTruthy();
});

test('each skip chip is an unselected button on first render (multi-select, none preselected)', async () => {
  const view = await render(<SkipsScreen />);
  const chips = view
    .getAllByRole('button')
    .filter((b) => b.props.accessibilityState && typeof b.props.accessibilityState.selected === 'boolean');
  expect(chips).toHaveLength(4);
  expect(chips.every((c) => c.props.accessibilityState.selected === false)).toBe(true);
});
