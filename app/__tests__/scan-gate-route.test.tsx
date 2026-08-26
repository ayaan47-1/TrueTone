import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import ScanGateScreen from '../scan-gate';

beforeEach(() => jest.clearAllMocks());

test('renders the on-device heading and both actions', async () => {
  const view = await render(<ScanGateScreen />);
  expect(view.getByText('Your scan stays on your device')).toBeTruthy();
  expect(view.getByText('Enable camera')).toBeTruthy();
  expect(view.getByText('Skip for now')).toBeTruthy();
});
