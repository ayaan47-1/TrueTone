import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const original = mapProductNode(PRODUCT_FIXTURE_NODE);
const first = { ...original.variants[1], id: 'gid://shopify/ProductVariant/101', title: 'Shade One' };
const second = { ...first, id: 'gid://shopify/ProductVariant/102', title: 'Shade Two' };
const mockProduct = { ...original, variants: [first, second] };
const mockPush = jest.fn();
const mockLimit = jest.fn();
const mockEq = jest.fn((_column: string, _value: string) => ({ limit: mockLimit }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
jest.mock('../../../../lib/supabase', () => ({ SUPABASE_OFFLINE: false, supabase: { from: (table: string) => mockFrom(table) } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ handle: mockProduct.handle }), useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }) }));
jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({ useShopifyStore: () => ({ products: [mockProduct], liveProductHandles: [mockProduct.handle] }), shopifyStore: { loadProduct: jest.fn() } }));
import ShopifyProductRoute from '../../../../../app/shop-product/[handle]';

beforeEach(() => {
  jest.clearAllMocks();
  mockLimit.mockImplementation(async () => ({ data: [{ variant_gid: mockEq.mock.calls.at(-1)?.[1] }], error: null }));
});

test('Shop route opens local feedback for the actual selected approved shade', async () => {
  const view = await render(<ShopifyProductRoute />);
  await waitFor(() => expect(view.getByText('How did this shade look?')).toBeTruthy());
  await fireEvent.press(view.getByText('How did this shade look?'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/shade-feedback', params: { variant: first.id } });
  await fireEvent.press(view.getByText('Shade Two'));
  await waitFor(() => expect(mockEq).toHaveBeenLastCalledWith('variant_gid', second.id));
  await waitFor(() => expect(view.getByText('How did this shade look?')).toBeTruthy());
  await fireEvent.press(view.getByText('How did this shade look?'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/shade-feedback', params: { variant: second.id } });
  expect(mockFrom).toHaveBeenCalledWith('catalog_recommendable');
});

test.each([
  { data: [], error: null },
  { data: null, error: { message: 'unavailable' } },
])('does not offer feedback for an unapproved or unavailable catalogue selection', async (response) => {
  mockLimit.mockResolvedValue(response);
  const view = await render(<ShopifyProductRoute />);
  await waitFor(() => expect(mockLimit).toHaveBeenCalled());
  expect(view.queryByText('How did this shade look?')).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});

test('a late approval for the previous shade cannot enable feedback for the new selection', async () => {
  type Approval = { data: { variant_gid: string }[]; error: null };
  let resolveFirst = (_value: Approval): void => { throw new Error('approval not requested'); };
  mockLimit.mockImplementationOnce(() => new Promise<Approval>((resolve) => { resolveFirst = resolve; }));
  mockLimit.mockResolvedValueOnce({ data: [], error: null });
  const view = await render(<ShopifyProductRoute />);
  await waitFor(() => expect(mockLimit).toHaveBeenCalledTimes(1));
  await fireEvent.press(view.getByText('Shade Two'));
  await waitFor(() => expect(mockLimit).toHaveBeenCalledTimes(2));
  await act(async () => { resolveFirst({ data: [{ variant_gid: first.id }], error: null }); });
  expect(view.queryByText('How did this shade look?')).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});

test('approval transport failure leaves feedback unavailable', async () => {
  mockLimit.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<ShopifyProductRoute />);
  await waitFor(() => expect(mockLimit).toHaveBeenCalledTimes(1));
  expect(view.queryByText('How did this shade look?')).toBeNull();
});
