// app/__tests__/scan-result-shade.test.tsx
// The live camera shade-match path of app/scan/result.tsx: when a tone read is present in
// the session seam, the screen derives the shade, persists it, and renders the shade name
// + product picks (NOT the skin-read analysis).
import { render, screen, waitFor } from '@testing-library/react-native';
import { latestRead } from '../../src/features/session/latest-read';
import { personalization } from '../../src/features/session/personalization';
import type { ShadeReadInput } from '../../src/features/shade/shade-types';

const mockFetchScanHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
  setRoutineFeedback: jest.fn(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: mockPush }),
}));

import ResultRoute from '../scan/result';

// lightness 0.5 -> depth 6 (Medium); warmth 0.3 -> warm; combination -> satin finish.
const toneRead: ShadeReadInput = {
  lightness: 0.5,
  warmth: 0.3,
  olive: 0.1,
  skinType: 'combination',
  oiliness: 0.4,
};

beforeEach(() => {
  jest.clearAllMocks();
  personalization.reset();
  latestRead.reset();
});
afterEach(() => {
  latestRead.reset();
  personalization.reset();
});

test('derives and renders the shade name from the live tone read', async () => {
  latestRead.set(toneRead);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
});

test('renders the product picks rail (matched to the shade)', async () => {
  latestRead.set(toneRead);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Picked for your shade')).toBeTruthy());
});

test('persists the derived shade via personalization.setScan', async () => {
  latestRead.set(toneRead);
  await render(<ResultRoute />);
  await waitFor(() => {
    const state = personalization.getState();
    expect(state.hasScanned).toBe(true);
    expect(state.currentShade?.shadeName).toBe('Medium Warm');
  });
});

test('does NOT show the skin-read analysis (no medical disclaimer / skin-type line)', async () => {
  latestRead.set(toneRead);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
  expect(screen.queryByText(/not a medical diagnosis/i)).toBeNull();
  expect(screen.queryByText(/Skin type feel:/i)).toBeNull();
});

test('does NOT hit the scan-history network path in the shade flow', async () => {
  latestRead.set(toneRead);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
  expect(mockFetchScanHistory).not.toHaveBeenCalled();
});

test('falls back to the skin-read flow when no tone read is present', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<ResultRoute />);
  await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalledWith(10));
});
