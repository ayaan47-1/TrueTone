import { render, fireEvent } from '@testing-library/react-native';
import { GlassTabBar } from '../GlassTabBar';

type View = Awaited<ReturnType<typeof render>>;

// `render` is async in this repo's setup; bind queries to each render's own result.
async function setup(overrides: Partial<React.ComponentProps<typeof GlassTabBar>> = {}) {
  const onSelect = jest.fn();
  const view = await render(<GlassTabBar activeKey="index" onSelect={onSelect} {...overrides} />);
  return { view, onSelect };
}

// Selecting from the tab list by accessibilityLabel is stable across the repo's
// async renders (the getByRole `{ name }` filter is not). All four destinations
// use the "tab" role — there is no longer a center "Shade match" button here (it
// moved to the For You header per the redesign).
function tab(view: View, label: string) {
  const match = view.queryAllByRole('tab').find((b) => b.props.accessibilityLabel === label);
  if (!match) throw new Error(`no tab control labelled "${label}"`);
  return match;
}

// A press schedules async work that, if not flushed, empties the *next* test's tree
// under the async-render + auto-cleanup combo. Flush after every press.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function press(view: View, label: string) {
  fireEvent.press(tab(view, label));
  await flush();
}

test('renders exactly four tab destinations and no center Shade match button', async () => {
  const { view } = await setup();
  expect(view.queryAllByRole('tab')).toHaveLength(4);
  ['Shop', 'For You', 'Trend', 'Account'].forEach((label) =>
    expect(tab(view, label)).toBeTruthy(),
  );
  // The floating center scan action is gone from the bar entirely.
  const scan = [...view.queryAllByRole('button'), ...view.queryAllByRole('tab')].find(
    (b) => b.props.accessibilityLabel === 'Shade match',
  );
  expect(scan).toBeUndefined();
});

test('Shop is the first (primary) tab destination', async () => {
  const { view } = await setup();
  const firstTab = view.queryAllByRole('tab')[0];
  expect(firstTab.props.accessibilityLabel).toBe('Shop');
});

test('marks the active tab as selected for accessibility', async () => {
  const { view } = await setup({ activeKey: 'trend' });
  expect(tab(view, 'Trend').props.accessibilityState).toMatchObject({ selected: true });
  expect(tab(view, 'For You').props.accessibilityState).toMatchObject({ selected: false });
});

test('pressing a tab calls onSelect with its route key', async () => {
  const { view, onSelect } = await setup();
  await press(view, 'Shop');
  expect(onSelect).toHaveBeenCalledWith('shop');
  await press(view, 'For You');
  expect(onSelect).toHaveBeenCalledWith('index');
  await press(view, 'Account');
  expect(onSelect).toHaveBeenCalledWith('you');
});
