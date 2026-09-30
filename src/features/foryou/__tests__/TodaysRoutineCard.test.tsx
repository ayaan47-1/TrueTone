// "Today's routine" card (kit RoutineCard3): AM/PM toggle, three checkable steps and a
// done count. Steps are SAMPLE data (home-sample-data.ts), not the user's logged routine.
import { render, fireEvent } from '@testing-library/react-native';
import { TodaysRoutineCard } from '../TodaysRoutineCard';

test('AM shows Prep / Base / Set with the first step done', async () => {
  const view = await render(<TodaysRoutineCard />);
  expect(view.getByText("Today's routine")).toBeTruthy();
  for (const t of ['Prep', 'Base', 'Set']) expect(view.getByText(t)).toBeTruthy();
  expect(view.getByText('Lightweight moisturizer')).toBeTruthy();
  expect(view.getByText('1 of 3 done')).toBeTruthy();
  expect(view.getByRole('checkbox', { name: 'Prep' }).props.accessibilityState).toMatchObject({ checked: true });
});

test('checking a step updates the count; unchecking reverses it', async () => {
  const view = await render(<TodaysRoutineCard />);
  await fireEvent.press(view.getByRole('checkbox', { name: 'Base' }));
  expect(view.getByText('2 of 3 done')).toBeTruthy();
  await fireEvent.press(view.getByRole('checkbox', { name: 'Base' }));
  expect(view.getByText('1 of 3 done')).toBeTruthy();
});

test('PM switches to the evening steps with their own progress', async () => {
  const view = await render(<TodaysRoutineCard />);
  await fireEvent.press(view.getByRole('button', { name: 'PM' }));
  for (const t of ['Remove', 'Refresh', 'Rest']) expect(view.getByText(t)).toBeTruthy();
  expect(view.getByText('0 of 3 done')).toBeTruthy();
  expect(view.getByRole('button', { name: 'PM' }).props.accessibilityState).toMatchObject({ selected: true });
});
