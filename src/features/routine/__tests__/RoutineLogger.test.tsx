import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoutineLogger } from '../components/RoutineLogger';
import { getPublishedRoutines } from '../routine-publish';
import { getRoutineLog } from '../routine-storage';
import { catalog } from '../../match/product-catalog';
import type { CommunityProfile } from '../../identity/community-profile-types';

const profile: CommunityProfile = { userId: 'u1', username: 'maya', avatarUri: null };
const first = catalog[0];

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('logging a product into AM shows it and persists to the user log', async () => {
  const view = await render(<RoutineLogger userId="u1" profile={profile} />);
  await fireEvent.press(view.getByTestId('routine-add-am'));
  await fireEvent.press(view.getByTestId(`routine-pick-${first.id}`));

  expect(view.getByText(first.name)).toBeTruthy();
  await waitFor(async () => {
    const log = await getRoutineLog('u1');
    expect(log[Object.keys(log)[0]].am).toContain(first.id);
  });
});

test('publish is disabled until something is logged, then shares to the local feed', async () => {
  const view = await render(<RoutineLogger userId="u1" profile={profile} />);
  expect(view.getByTestId('routine-publish').props.accessibilityState?.disabled).toBe(true);

  await fireEvent.press(view.getByTestId('routine-add-pm'));
  await fireEvent.press(view.getByTestId(`routine-pick-${first.id}`));
  await fireEvent.press(view.getByTestId('routine-publish'));

  await waitFor(() => expect(view.getByTestId('routine-published')).toBeTruthy());
  const feed = await getPublishedRoutines();
  expect(feed).toHaveLength(1);
  expect(feed[0].taggedProductIds).toContain(first.id);
  expect(feed[0].creator.username).toBe('maya');
});

test('without a profile, publishing is unavailable', async () => {
  const view = await render(<RoutineLogger userId="u1" profile={null} />);
  await fireEvent.press(view.getByTestId('routine-add-am'));
  await fireEvent.press(view.getByTestId(`routine-pick-${first.id}`));
  expect(view.getByTestId('routine-publish').props.accessibilityState?.disabled).toBe(true);
});
