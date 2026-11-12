import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DataRights } from '../DataRights';
import { ProfileProvider, useProfile } from '../../../lib/profile-context';
import { cameraDemoSetConsent, cameraDemoSetIs18 } from '../../../lib/camera-demo-profile';

jest.mock('../../../lib/supabase', () => ({ SUPABASE_OFFLINE: true, CAMERA_DEMO: true, DEMO_MODE: false, supabase: {} }));
jest.mock('../../../lib/auth', () => ({ bootstrapSession: jest.fn() }));
jest.mock('../../shade-feedback/runtime', () => ({ clearAllLocalFeedback: async () => { throw new Error('storage unavailable'); } }));

function Device() {
  const { route, refresh } = useProfile();
  return <>
    <Text testID="capture-gate">{route}</Text>
    <DataRights onChanged={() => void refresh()} confirm={async () => true} />
  </>;
}

test('failed feedback clearing cannot leave the real profile route open to capture after withdrawal', async () => {
  cameraDemoSetIs18();
  cameraDemoSetConsent();
  const view = await render(<ProfileProvider><Device /></ProfileProvider>);
  await waitFor(() => expect(view.getByTestId('capture-gate').props.children).toBe('home'));
  await fireEvent.press(view.getByTestId('withdraw'));
  await waitFor(() => expect(view.getByTestId('capture-gate').props.children).toBe('consent'));
  expect(view.getByText(/Some local shade feedback could not be cleared/)).toBeTruthy();
});
