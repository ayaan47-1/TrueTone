// v3 product page: shade picker, qty, "Why it fits you", add to bag with the chosen shade.
// Fit is a tier word only; ratings/reviews only behind SAMPLE_RATINGS_ENABLED, with the label.
import { render, fireEvent } from '@testing-library/react-native';
import { ProductDetail } from '../ProductDetail';
import { Share } from 'react-native';
import { bag } from '../../checkout/bag-store';
import { wishlist } from '../wishlist-store';
import { SAMPLE_RATINGS_LABEL } from '../sample-content';
import type { MatchProfile } from '../../match/match-types';

const ID = 'ver-velvet-10'; // Veranda Velvet Matte Foundation, Honey 5W, $33
const PROFILE: MatchProfile = { shade: 6, undertone: 'warm', coverage: 'everyday', skips: [] };

beforeEach(() => bag.clear());

test('pre-scan: invites a scan instead of showing a fit', async () => {
  const onScan = jest.fn();
  const view = await render(<ProductDetail productId={ID} onScan={onScan} onAdded={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByText('Velvet Matte Foundation')).toBeTruthy();
  expect(view.queryByTestId('fit-tier')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Scan to see your fit' }));
  expect(onScan).toHaveBeenCalled();
  expect(view.getByText('Scan your shade to see a personal fit explanation.')).toBeTruthy();
});

test('post-scan: tier word for your shade, why-it-fits, your match preselected', async () => {
  const view = await render(
    <ProductDetail productId={ID} profile={PROFILE} shadeName="Golden 6W" onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />,
  );
  expect(view.getByTestId('fit-tier')).toHaveTextContent(/^(Great match|Good match|Worth a try) for Golden 6W$/);
  expect(view.getByTestId('selected-shade')).toHaveTextContent('Golden 6W');
  expect(view.getAllByText(/Your match/).length).toBeGreaterThan(0);
  expect(view.queryAllByText(/%|★|review|off/i)).toHaveLength(0);
});

test('picking a shade + qty adds that line to the bag', async () => {
  const onAdded = jest.fn();
  const view = await render(<ProductDetail productId={ID} onScan={jest.fn()} onAdded={onAdded} onClose={jest.fn()} />);
  await fireEvent.press(view.getByRole('button', { name: 'Shade Amber 7W' }));
  await fireEvent.press(view.getByRole('button', { name: 'Increase quantity' }));
  await fireEvent.press(view.getByRole('button', { name: 'Add to bag · $66' }));
  expect(bag.getState().lines).toEqual([expect.objectContaining({ qty: 2, shade: 'Amber 7W' })]);
  expect(onAdded).toHaveBeenCalled();
});

test('an unknown id renders a calm not-found state', async () => {
  const view = await render(<ProductDetail productId="nope" onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByText('This product isn’t available')).toBeTruthy();
});

test('a scan that lands while the page is open re-selects your match', async () => {
  const view = await render(<ProductDetail productId={ID} onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByTestId('selected-shade')).toHaveTextContent('Honey 5W');
  await view.rerender(<ProductDetail productId={ID} profile={PROFILE} onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByTestId('selected-shade')).toHaveTextContent('Golden 6W');
});

test('a visible back button over the art closes the sheet (48px tap target)', async () => {
  const onClose = jest.fn();
  const view = await render(
    <ProductDetail productId={ID} onScan={jest.fn()} onAdded={jest.fn()} onClose={onClose} />,
  );
  const back = view.getByRole('button', { name: 'Back' });
  expect(back).toHaveStyle({ width: 48, height: 48 });
  await fireEvent.press(back);
  expect(onClose).toHaveBeenCalled();
});

test('the not-found state also offers a way back', async () => {
  const onClose = jest.fn();
  const view = await render(<ProductDetail productId="nope" onScan={jest.fn()} onAdded={jest.fn()} onClose={onClose} />);
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  expect(onClose).toHaveBeenCalled();
});

describe('v3 frames t-11 / t-12', () => {
  const props = { onScan: jest.fn(), onAdded: jest.fn(), onClose: jest.fn() };

  test('photo gallery with page dots, In stock pill, share + save buttons', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    wishlist.clear();
    const view = await render(<ProductDetail productId={ID} {...props} />);
    expect(view.getAllByTestId('gallery-slide').length).toBeGreaterThan(1);
    expect(view.getAllByTestId(/^gallery-dot/).length).toBe(view.getAllByTestId('gallery-slide').length);
    expect(view.getByTestId('product-photo')).toBeTruthy();
    expect(view.getByText('In stock')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Veranda Velvet Matte Foundation') }));
    await fireEvent.press(view.getByRole('button', { name: 'Save Veranda Velvet Matte Foundation' }));
    expect(wishlist.getState()).toEqual([ID]);
  });

  test('size chips (30 ml / 50 ml) are selectable on liquid bases', async () => {
    const view = await render(<ProductDetail productId={ID} {...props} />);
    const big = view.getByRole('button', { name: 'Size 50 ml' });
    await fireEvent.press(big);
    expect(view.getByRole('button', { name: 'Size 50 ml' })).toHaveAccessibilityState({ selected: true });
    expect(view.getByRole('button', { name: 'Size 30 ml' })).toHaveAccessibilityState({ selected: false });
  });

  test('no size row for products without sizes', async () => {
    const view = await render(<ProductDetail productId="lum-lip-29" {...props} />);
    expect(view.queryByText('Size')).toBeNull();
  });

  test('a great-match product says "Your match" in the fit card, never a %', async () => {
    const view = await render(<ProductDetail productId="aur-tint-12" profile={PROFILE} shadeName="Golden 6W" {...props} />);
    expect(view.getByTestId('fit-tier')).toHaveTextContent('Great match for Golden 6W');
    expect(view.getByTestId('fit-your-match')).toHaveTextContent('Your match');
    expect(view.queryAllByText(/%/)).toHaveLength(0);
  });

  test('sample rating shows only when enabled, with its label', async () => {
    const off = await render(<ProductDetail productId={ID} {...props} />);
    expect(off.queryByText('★')).toBeNull();
    off.unmount();
    const on = await render(<ProductDetail productId={ID} showRatings {...props} />);
    expect(on.getByText('★')).toBeTruthy();
    expect(on.getByText(SAMPLE_RATINGS_LABEL)).toBeTruthy();
  });
});
