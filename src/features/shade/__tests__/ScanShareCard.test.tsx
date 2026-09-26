import { render } from '@testing-library/react-native';
import { ScanShareCard, SCAN_SHARE_DOWNLOAD_URL } from '../ScanShareCard';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { CurrentShade } from '../shade-types';

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 5, finish: 'satin' };

test('renders the shade name, cosmetic descriptor line, branding, and download link', async () => {
  const view = await render(<ScanShareCard shade={shade} />);
  expect(view.getByText('Medium Warm')).toBeTruthy();
  expect(view.getByText(/Satin/)).toBeTruthy();
  expect(view.getByText('TrueTone')).toBeTruthy();
  expect(view.getByText(SCAN_SHARE_DOWNLOAD_URL)).toBeTruthy();
  expect(SCAN_SHARE_DOWNLOAD_URL).toBe('https://truetone.app/download');
  // Qualitative descriptors, never a raw numeric depth.
  expect(view.queryByText('5')).toBeNull();
});

test('every rendered string is free of disease/diagnostic terms', async () => {
  const view = await render(<ScanShareCard shade={shade} />);
  expect(findDiseaseTerms(JSON.stringify(view.toJSON()))).toEqual([]);
});
