import { render } from '@testing-library/react-native';
import { ShadeResult } from '../ShadeResult';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { CurrentShade } from '../shade-types';

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 5, finish: 'satin' };

test('renders the shade name, descriptor line, and swatch labels', async () => {
  const view = await render(<ShadeResult shade={shade} />);
  expect(view.getByText('Medium Warm')).toBeTruthy();
  // Qualitative descriptors, never a raw numeric depth.
  expect(view.getByText('Warm')).toBeTruthy();
  expect(view.getByText('Satin')).toBeTruthy();
  expect(view.getAllByText('Medium').length).toBeGreaterThan(0);
  expect(view.queryByText('5')).toBeNull();
});

test('renders a cosmetic Today\'s tip line with no disease terms', async () => {
  const view = await render(<ShadeResult shade={shade} />);
  const tip = view.getByText(/satin finish/i);
  expect(findDiseaseTerms(tip.props.children as string)).toEqual([]);
});

test('renders both CTA buttons', async () => {
  const view = await render(<ShadeResult shade={shade} onSeeLook={() => {}} onShare={() => {}} />);
  expect(view.getByText('See my look')).toBeTruthy();
  expect(view.getByText('Share')).toBeTruthy();
});
