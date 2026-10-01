// Home hero carousel (video t-01): three photo slides with page dots — the shade slide,
// "Finish your look" and the TRUE15 promo, which carries the required demo label
// (v3-demo-content-ruling item 3). Never a numeric fit.
import { render, fireEvent } from '@testing-library/react-native';
import * as HeroModule from '../HeroCarousel';
import { HeroCarousel } from '../HeroCarousel';
import { DEMO_PROMO_LABEL } from '../../shop/sample-content';

const noop = () => undefined;

test('post-scan shade slide names the shade and the pick count, and opens the shop', async () => {
  const onShop = jest.fn();
  const view = await render(<HeroCarousel shadeName="Warm Sand" pickCount={12} onScan={noop} onShop={onShop} />);
  expect(view.getByText('Your shade')).toBeTruthy();
  expect(view.getByText('Warm Sand is your match')).toBeTruthy();
  expect(view.getByText('12 picks ranked for your tone.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'See my matches' }));
  expect(onShop).toHaveBeenCalled();
  expect(view.queryAllByText(/\d+% fit/)).toHaveLength(0);
});

test('pre-scan shade slide invites a scan with no timing claim', async () => {
  const onScan = jest.fn();
  const view = await render(<HeroCarousel onScan={onScan} onShop={noop} />);
  expect(view.getByText('Find your true shade')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Start scan' }));
  expect(onScan).toHaveBeenCalled();
  expect(view.queryAllByText(/seconds/i)).toHaveLength(0);
});

test('has three photo slides with page dots; the promo slide is labelled demo', async () => {
  const onShop = jest.fn();
  const view = await render(<HeroCarousel shadeName="Warm Sand" pickCount={12} onScan={noop} onShop={onShop} />);
  expect(view.getAllByTestId(/^hero-slide-/)).toHaveLength(3);
  expect(view.getAllByTestId(/^hero-dot-/)).toHaveLength(3);
  expect(view.getByText('Your base, complete')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Shop the set' }));
  expect(onShop).toHaveBeenCalled();
  expect(view.getByText('15% off')).toBeTruthy();
  expect(view.getByText('TRUE15')).toBeTruthy();
  expect(view.getByText('Demo promo — no purchases in this build.')).toBeTruthy();
});

test('tapping a dot selects that slide', async () => {
  const view = await render(<HeroCarousel onScan={noop} onShop={noop} />);
  await fireEvent.press(view.getByTestId('hero-dot-2'));
  expect(view.getByTestId('hero-dot-2').props.accessibilityState).toEqual({ selected: true });
  expect(view.getByTestId('hero-dot-0').props.accessibilityState).toEqual({ selected: false });
});

test('the promo slide uses the one shared DEMO_PROMO_LABEL (no local copy to drift)', async () => {
  expect('DEMO_PROMO_LABEL' in HeroModule).toBe(false);
  const view = await render(<HeroCarousel onScan={noop} onShop={noop} />);
  expect(view.getByText(DEMO_PROMO_LABEL)).toBeTruthy();
});
