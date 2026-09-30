// Heart (saved) button + the flag-gated sample rating line.
import { render, fireEvent } from '@testing-library/react-native';
import { HeartButton } from '../HeartButton';
import { SampleRatingLine } from '../SampleRatingLine';
import { wishlist } from '../wishlist-store';
import { sampleRating, SAMPLE_RATINGS_LABEL } from '../sample-content';

beforeEach(() => wishlist.clear());

test('heart toggles the product in the wishlist and reflects the state', async () => {
  const view = await render(<HeartButton productId="lum-tint-01" name="Tint" />);
  await fireEvent.press(view.getByRole('button', { name: 'Save Tint' }));
  expect(wishlist.getState()).toEqual(['lum-tint-01']);
  expect(view.getByRole('button', { name: 'Remove Tint from saved' })).toBeTruthy();
});

test('rating line renders nothing while the flag is off', async () => {
  const view = await render(<SampleRatingLine productId="lum-tint-01" enabled={false} />);
  expect(view.toJSON()).toBeNull();
});

test('rating line shows the sample rating with the ruled label beside it when on', async () => {
  const r = sampleRating('lum-tint-01');
  const view = await render(<SampleRatingLine productId="lum-tint-01" enabled />);
  expect(view.getByText(String(r.rating))).toBeTruthy();
  expect(view.getByText(`(${r.reviews.toLocaleString('en-US')})`)).toBeTruthy();
  expect(view.getByText(SAMPLE_RATINGS_LABEL)).toBeTruthy();
});
