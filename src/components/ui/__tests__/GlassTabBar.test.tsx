import { render, fireEvent } from '@testing-library/react-native';
import { GlassTabBar } from '../GlassTabBar';

type View = Awaited<ReturnType<typeof render>>;

// `render` is async in this repo's setup; bind queries to each render's own result.
async function setup(overrides: Partial<React.ComponentProps<typeof GlassTabBar>> = {}) {
  const onSelect = jest.fn();
  const onScanPress = jest.fn();
  const view = await render(
    <GlassTabBar activeKey="index" onSelect={onSelect} onScanPress={onScanPress} {...overrides} />,
  );
  return { view, onSelect, onScanPress };
}

// Selecting from the control list by accessibilityLabel is stable across the
// repo's async renders (the getByRole `{ name }` filter is not). Tabs use the
// "tab" role; the center Scan action uses "button".
function button(view: View, label: string) {
  const all = [...view.queryAllByRole('tab'), ...view.queryAllByRole('button')];
  const match = all.find((b) => b.props.accessibilityLabel === label);
  if (!match) throw new Error(`no tab control labelled "${label}"`);
  return match;
}

// A press schedules async work that, if not flushed, empties the *next* test's tree
// under the async-render + auto-cleanup combo. Flush after every press.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function press(view: View, label: string) {
  fireEvent.press(button(view, label));
  await flush();
}

test('renders all five destinations including the center Scan action', async () => {
  const { view } = await setup();
  ['Today', 'Routine', 'Scan', 'Trend', 'You'].forEach((label) =>
    expect(button(view, label)).toBeTruthy(),
  );
});

test('marks the active tab as selected for accessibility', async () => {
  const { view } = await setup({ activeKey: 'trend' });
  expect(button(view, 'Trend').props.accessibilityState).toMatchObject({ selected: true });
  expect(button(view, 'Today').props.accessibilityState).toMatchObject({ selected: false });
});

test('tabs use the "tab" role and Scan uses the "button" role', async () => {
  const { view } = await setup();
  expect(view.queryAllByRole('tab')).toHaveLength(4);
  expect(button(view, 'Scan').props.accessibilityRole).toBe('button');
});

test('pressing a tab calls onSelect with its route key', async () => {
  const { view, onSelect, onScanPress } = await setup();
  await press(view, 'Routine');
  expect(onSelect).toHaveBeenCalledWith('routine');
  await press(view, 'You');
  expect(onSelect).toHaveBeenCalledWith('you');
  expect(onScanPress).not.toHaveBeenCalled();
});

test('pressing the center Scan button calls onScanPress, not onSelect', async () => {
  const { view, onSelect, onScanPress } = await setup();
  await press(view, 'Scan');
  expect(onScanPress).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
});
