// Cross-screen drift guard (Pam, integrated build review): every small uppercase section /
// brand-line label routes through the shared Eyebrow, and home section titles share one size.
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
import { catalog } from '../../match/product-catalog';
import { productLine } from '../product-visual';
import { ProductTile } from '../ProductTile';
import { ProductDetail } from '../ProductDetail';
import { FilterSheet } from '../FilterSheet';
import { AccountGroup } from '../../account/AccountParts';
import { SeasonalSheet } from '../../foryou/SeasonalSheet';
import { TodaysRoutineCardView } from '../../foryou/TodaysRoutineCard';
import { SectionHead } from '../../foryou/HomeV3Parts';
import { BagScreen } from '../../checkout/BagScreen';
import { bag } from '../../checkout/bag-store';

const noop = () => undefined;
const product = catalog.find((p) => productLine(p).line) ?? catalog[0];
const { line } = productLine(product);

function expectEyebrow(node: { props: { className?: string } }) {
  const cls = String(node.props.className ?? '');
  expect(cls).toContain('tracking-[1.6px]');
  expect(cls).toContain('text-brand-green');
  expect(cls).not.toMatch(/tracking-\[1(\.[024])?px\]/);
}

test('product brand line uses Eyebrow on tile, detail and bag', async () => {
  const tile = await render(<ProductTile product={product} onOpen={noop} />);
  expectEyebrow(tile.getByText(line));
  const detail = await render(<ProductDetail productId={product.id} onScan={noop} onAdded={noop} onClose={noop} />);
  expectEyebrow(detail.getAllByText(line)[0]);
  bag.clear();
  bag.add(product);
  const bagView = await render(<BagScreen onShop={noop} onCheckout={noop} onBack={noop} />);
  expectEyebrow(bagView.getAllByText(line)[0]);
  bag.clear();
});

test('section labels use Eyebrow on Account, Sort & filter and Seasonal', async () => {
  const account = await render(<AccountGroup title="Shopping" rows={[{ label: 'Orders', onPress: noop }]} />);
  expectEyebrow(account.getByText('Shopping'));
  const sheet = await render(
    <FilterSheet visible sort="match" finish="any" scanned showRatingSort={false} onApply={noop} onClose={noop} />,
  );
  expectEyebrow(sheet.getByText('Sort by'));
  const seasonal = await render(<SeasonalSheet onScan={noop} onClose={noop} />);
  expectEyebrow(seasonal.getByText('Seasonal'));
});

test("home card titles share SectionHead's size (Today's routine included)", async () => {
  const head = await render(<SectionHead title="Running low" />);
  const routine = await render(<TodaysRoutineCardView routine={{ date: '2026-10-04', am: [], pm: [] }} onOpen={noop} />);
  expect(routine.getByText("Today's routine").props.className).toBe(head.getByText('Running low').props.className);
});
