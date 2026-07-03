// src/features/read/__tests__/Result.test.tsx
import { render, screen } from '@testing-library/react-native';
import { Result } from '../Result';
import { DIMENSIONS as ALL_DIMS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../read-types';

const scores = Object.fromEntries(ALL_DIMS.map((d) => [d, 0.5])) as ScoreVector;
const flatScores = Object.fromEntries(ALL_DIMS.map((d) => [d, 0.5])) as ScoreVector;

test('shows the non-diagnostic disclaimer', async () => {
  await render(<Result scores={scores} skinType="combination" prev={null} />);
  expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy();
});
test('shows a band label for hydration and never shows a raw number', async () => {
  // hydration at 0.9 maps to the band-2 label 'Looks well-hydrated', which is unique to hydration
  // (the shared mid-band 'Balanced' would match multiple rows), so we can assert one specific row.
  await render(<Result scores={{ ...scores, hydration: 0.9 }} skinType="combination" prev={null} />);
  expect(screen.getByText('Looks well-hydrated')).toBeTruthy();
  expect(screen.queryByText('0.5')).toBeNull();
  expect(screen.queryByText('0.9')).toBeNull();
});
test('shows the dermatologist redirect', async () => {
  await render(<Result scores={scores} skinType="combination" prev={null} />);
  expect(screen.getByText(/dermatologist/i)).toBeTruthy();
});

// --- personalization card (spec §4.1) ---
test('renders the personal card when personalMessages are provided', async () => {
  await render(
    <Result
      scores={flatScores}
      skinType="combination"
      prev={null}
      personalMessages={['Hydration look is down compared to your usual — worth a gentle focus.']}
    />,
  );
  expect(screen.getAllByText(/compared to your usual/i).length).toBeGreaterThan(0);
});

test('omits the personal card when personalMessages is absent (cold start = today)', async () => {
  await render(<Result scores={flatScores} skinType="combination" prev={null} />);
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});
