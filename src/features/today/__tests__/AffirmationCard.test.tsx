import { Share } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AffirmationCard } from '../AffirmationCard';
import { pickAffirmation } from '../affirmations';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockShare = jest
  .spyOn(Share, 'share')
  .mockResolvedValue({ action: 'sharedAction', activityType: null });

beforeEach(() => mockShare.mockClear());

test('shows today’s affirmation', async () => {
  const today = new Date(2026, 5, 24);
  const view = await render(<AffirmationCard today={today} />);
  expect(view.getByText(pickAffirmation(today))).toBeTruthy();
});

test('shares the affirmation text when Share is tapped', async () => {
  const today = new Date(2026, 5, 24);
  const view = await render(<AffirmationCard today={today} />);
  fireEvent.press(view.getByRole('button', { name: /share/i }));
  await flush();
  expect(mockShare).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining(pickAffirmation(today)) }),
  );
});
