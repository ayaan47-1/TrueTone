// Home hero carousel (video t-01): shade and "Finish your look" photo slides with page dots.
// Never a numeric fit.
import { render, fireEvent } from '@testing-library/react-native';
import { HeroCarousel } from '../HeroCarousel';

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

test('has two photo slides with page dots', async () => {
  const onShop = jest.fn();
  const view = await render(<HeroCarousel shadeName="Warm Sand" pickCount={12} onScan={noop} onShop={onShop} />);
  expect(view.getAllByTestId(/^hero-slide-/)).toHaveLength(2);
  expect(view.getAllByTestId(/^hero-dot-/)).toHaveLength(2);
  expect(view.getByText('Your base, complete')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Shop the set' }));
  expect(onShop).toHaveBeenCalled();
  expect(view.queryByText('15% off')).toBeNull();
});

test('tapping a dot selects that slide', async () => {
  const view = await render(<HeroCarousel onScan={noop} onShop={noop} />);
  await fireEvent.press(view.getByTestId('hero-dot-1'));
  expect(view.getByTestId('hero-dot-1').props.accessibilityState).toEqual({ selected: true });
  expect(view.getByTestId('hero-dot-0').props.accessibilityState).toEqual({ selected: false });
});
