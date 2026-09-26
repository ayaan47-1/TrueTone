import { Share, StyleSheet } from 'react-native';
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

test('shared message includes attribution and the exact download link', async () => {
  const today = new Date(2026, 5, 24);
  const view = await render(<AffirmationCard today={today} />);
  fireEvent.press(view.getByRole('button', { name: /share/i }));
  await flush();
  const { message } = mockShare.mock.calls[0][0] as { message: string };
  expect(message).toContain('TrueTone');
  expect(message).toContain('https://truetone.app/download');
});

test('share control meets the 48pt minimum touch target', async () => {
  const today = new Date(2026, 5, 24);
  const view = await render(<AffirmationCard today={today} />);
  const shareButton = view.getByRole('button', { name: /share/i });
  const flatStyle = StyleSheet.flatten(shareButton.props.style);
  expect(flatStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(flatStyle.minWidth).toBeGreaterThanOrEqual(48);
});
