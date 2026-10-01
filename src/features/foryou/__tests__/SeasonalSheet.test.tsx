// Seasonal quick action (video t-01 "Seasonal · NEW"): a sheet that invites a seasonal
// rescan. No progress numbers — we do not track seasonal scans yet.
import { render, fireEvent } from '@testing-library/react-native';
import { SeasonalSheet } from '../SeasonalSheet';

test('explains the seasonal check and starts a scan or closes', async () => {
  const onScan = jest.fn();
  const onClose = jest.fn();
  const view = await render(<SeasonalSheet onScan={onScan} onClose={onClose} />);
  expect(view.getByText('Seasonal shade check')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Scan again' }));
  expect(onScan).toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Not now' }));
  expect(onClose).toHaveBeenCalled();
  expect(view.queryAllByText(/\d+ of \d+/)).toHaveLength(0);
});
