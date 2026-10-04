// Home "Today's routine" card: an in-app widget summarising the user's OWN on-device routine
// (same data as the Routine page), with a button that opens the Routine page.
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TodaysRoutineCard, TodaysRoutineCardView } from '../TodaysRoutineCard';
import { saveDay } from '../../routine/routine-storage';
import { catalog } from '../../match/product-catalog';
import { toDateKey } from '../../today/week';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../lib/profile-context', () => ({ useProfile: () => ({ userId: 'u1' }) }));

const [p0, p1, p2, p3, p4] = catalog;
const day = (am: string[], pm: string[]) => ({ date: '2026-10-04', am, pm });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('summarises step counts and lists the morning steps', async () => {
  const view = await render(<TodaysRoutineCardView routine={day([p0.id, p1.id], [p2.id])} onOpen={() => {}} />);
  expect(view.getByText("Today's routine")).toBeTruthy();
  expect(view.getByText('2 morning · 1 evening steps')).toBeTruthy();
  expect(view.getByText(p0.name)).toBeTruthy();
  expect(view.getByText(p1.name)).toBeTruthy();
  expect(view.queryByText(p2.name)).toBeNull();
});

test('PM toggle shows the evening steps; long slots collapse to "+N more"', async () => {
  const view = await render(
    <TodaysRoutineCardView routine={day([], [p0.id, p1.id, p2.id, p3.id, p4.id])} onOpen={() => {}} />,
  );
  await fireEvent.press(view.getByRole('button', { name: 'PM' }));
  expect(view.getByText(p0.name)).toBeTruthy();
  expect(view.getByText('+2 more')).toBeTruthy();
});

test('empty routine invites building one; the button opens the Routine page', async () => {
  const onOpen = jest.fn();
  const view = await render(<TodaysRoutineCardView routine={day([], [])} onOpen={onOpen} />);
  expect(view.getByText(/no steps yet/i)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Build your routine' }));
  expect(onOpen).toHaveBeenCalled();
});

test('container reads the saved routine and its button routes to /routine', async () => {
  await saveDay('u1', { date: toDateKey(new Date()), am: [p3.id], pm: [] });
  const view = await render(<TodaysRoutineCard />);
  await waitFor(() => expect(view.getByText(p3.name)).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Open routine' }));
  expect(mockPush).toHaveBeenCalledWith('/routine');
});
