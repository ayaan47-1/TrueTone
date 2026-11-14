import { act, fireEvent, render } from '@testing-library/react-native';
import { ProfileCard } from '../AccountParts';
import { accountSummary } from '../account-summary';

const summary = accountSummary({ username: 'ada', savedCount: 0, streak: 0, scanCount: 0, shadeName: null, demo: false });
const props = { summary, scanned: false, avatarDisabled: false, onAvatar: jest.fn(), onEdit: jest.fn(), editing: false };
const oldUri = 'file:///cache/truetone-avatar/avatar-1.jpg';
const newUri = 'file:///cache/truetone-avatar/avatar-2.jpg';

test('an evicted avatar falls back to the initial without losing the profile', async () => {
  const view = await render(<ProfileCard {...props} avatarUri={oldUri} />);
  await fireEvent(view.getByTestId('avatar-image'), 'error', { nativeEvent: { error: 'file missing' } });
  expect(view.queryByTestId('avatar-image')).toBeNull();
  expect(view.getByText('A')).toBeTruthy();
  expect(view.getByText('ada')).toBeTruthy();
  expect(view.getByText('@ada')).toBeTruthy();
});

test('a new photo is tried after the old cached photo failed', async () => {
  const view = await render(<ProfileCard {...props} avatarUri={oldUri} />);
  await fireEvent(view.getByTestId('avatar-image'), 'error');
  expect(view.getByText('A')).toBeTruthy();
  await view.rerender(<ProfileCard {...props} avatarUri={newUri} />);
  expect(view.getByTestId('avatar-image').props.source).toEqual({ uri: newUri });
});

test('an old image error cannot hide a newer photo', async () => {
  const view = await render(<ProfileCard {...props} avatarUri={oldUri} />);
  const oldError = view.getByTestId('avatar-image').props.onError;
  expect(typeof oldError).toBe('function');
  await view.rerender(<ProfileCard {...props} avatarUri={newUri} />);
  await act(async () => { oldError({ nativeEvent: { error: 'file missing' } }); });
  expect(view.getByTestId('avatar-image').props.source).toEqual({ uri: newUri });
});
