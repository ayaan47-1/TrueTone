import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoutineEditor } from '../components/RoutineEditor';
import { getRoutineLog, saveDay } from '../routine-storage';
import { catalog } from '../../match/product-catalog';
import { toDateKey } from '../../today/week';

const [p0, p1, p2] = catalog;
const today = toDateKey(new Date());

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('empty routine invites the user to add steps for each slot', async () => {
  const view = await render(<RoutineEditor userId="u1" purchasedIds={[]} savedIds={[]} />);
  expect(await view.findByText('Morning')).toBeTruthy();
  expect(view.getByText('Evening')).toBeTruthy();
  expect(view.getAllByText(/no steps yet/i)).toHaveLength(2);
});

test('add: the picker lists purchased then saved items first, and adding persists', async () => {
  const view = await render(<RoutineEditor userId="u1" purchasedIds={[p2.id]} savedIds={[p1.id]} />);
  await fireEvent.press(await view.findByTestId('routine-add-am'));
  expect(view.getByText('From your orders')).toBeTruthy();
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.getByText('All products')).toBeTruthy();
  await fireEvent.press(view.getByTestId(`routine-pick-${p2.id}`));
  expect(view.getByText(p2.name)).toBeTruthy();
  await waitFor(async () => expect((await getRoutineLog('u1'))[today].am).toEqual([p2.id]));
});

test('edit: swaps a step for another product in place', async () => {
  await saveDay('u1', { date: today, am: [p0.id], pm: [] });
  const view = await render(<RoutineEditor userId="u1" purchasedIds={[]} savedIds={[]} />);
  await fireEvent.press(await view.findByTestId(`routine-edit-am-${p0.id}`));
  await fireEvent.press(view.getByTestId(`routine-pick-${p1.id}`));
  expect(view.getByText(p1.name)).toBeTruthy();
  expect(view.queryByText(p0.name)).toBeNull();
  await waitFor(async () => expect((await getRoutineLog('u1'))[today].am).toEqual([p1.id]));
});

test('remove: drops the step', async () => {
  await saveDay('u1', { date: today, am: [], pm: [p0.id] });
  const view = await render(<RoutineEditor userId="u1" purchasedIds={[]} savedIds={[]} />);
  await fireEvent.press(await view.findByTestId(`routine-remove-pm-${p0.id}`));
  expect(view.queryByText(p0.name)).toBeNull();
  await waitFor(async () => expect((await getRoutineLog('u1'))[today].pm).toEqual([]));
});
