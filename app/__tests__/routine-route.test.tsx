import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import RoutineRoute from '../(tabs)/routine';
import { fetchLatestScan } from '../../src/lib/scans';

jest.mock('../../src/lib/scans', () => ({ fetchLatestScan: jest.fn() }));

const SAMPLE_SCAN = {
  id: 's1', capturedAt: '2026-06-18', skinType: 'dry',
  scores: {}, modelVersion: 'stub-1', isStub: true,
  routine: {
    version: 'skincare-1',
    am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] }],
    pm: [], notes: [],
  },
};

beforeEach(() => jest.clearAllMocks());

test('renders the latest scan routine', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue(SAMPLE_SCAN);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

test('navigates to /scan/chat with the scanId when the button is pressed', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue(SAMPLE_SCAN);
  await render(<RoutineRoute />);
  const button = await screen.findByText(/ask about your routine/i);
  fireEvent.press(button);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/scan/chat', params: { scanId: 's1' } });
});

test('shows a retry state when the scan fetch fails', async () => {
  (fetchLatestScan as jest.Mock).mockRejectedValue(new Error('network'));
  await render(<RoutineRoute />);
  expect(await screen.findByText(/couldn.t load your routine/i)).toBeTruthy();
});
