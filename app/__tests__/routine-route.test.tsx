import { render, screen, waitFor } from '@testing-library/react-native';
import RoutineRoute from '../scan/routine';
import { fetchLatestScan } from '../../src/lib/scans';

jest.mock('../../src/lib/scans', () => ({ fetchLatestScan: jest.fn() }));

test('renders the latest scan routine', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue({
    id: 's1', capturedAt: '2026-06-18', skinType: 'dry',
    scores: {}, modelVersion: 'stub-1', isStub: true,
    routine: { version: 'skincare-1', am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] }], pm: [], notes: [] },
  });
  render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});
