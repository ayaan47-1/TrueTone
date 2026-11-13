import {PRODUCT_FIXTURE_NODE} from '../fixtures/products';
import {mapProductNode} from '../product-mapper';
const mockList=jest.fn(),mockProduct=jest.fn();
jest.mock('../runtime',()=>({getShopifyServices:()=>({catalog:{list:mockList,getByHandle:mockProduct},catalogCache:{read:async()=>null,write:async()=>{}},cart:{}})}));
import {shopifyStore,__resetShopifyStoreForTests} from '../shopify-store';
const base=mapProductNode(PRODUCT_FIXTURE_NODE);
const first={...base,variants:[base.variants[1]],optionsPage:{nextCursor:'next'}};
beforeEach(()=>{__resetShopifyStoreForTests();jest.clearAllMocks();mockList.mockResolvedValue([first]);});
test('explicit option pagination merges only that product and does not re-list the catalogue',async()=>{
  await shopifyStore.loadProducts();
  const second={...base.variants[1],id:'gid://shopify/ProductVariant/99'};
  mockProduct.mockResolvedValue({...base,variants:[second],optionsPage:{nextCursor:null}});
  await shopifyStore.loadMoreOptions(base.handle);
  expect(mockProduct).toHaveBeenCalledWith(base.handle,'next');expect(mockList).toHaveBeenCalledTimes(1);
  expect(shopifyStore.getState().products[0].variants.map(variant=>variant.id)).toEqual([first.variants[0].id,second.id]);
});
test('failed option pagination retains its cursor and exposes a safe retry state',async()=>{
  await shopifyStore.loadProducts();mockProduct.mockRejectedValue(Error('private upstream body'));
  await shopifyStore.loadMoreOptions(base.handle);
  expect(shopifyStore.getState().products[0].optionsPage?.nextCursor).toBe('next');
  expect(shopifyStore.getState().error).toBe('The shop is unavailable right now. Please try again.');
  expect(shopifyStore.getState().loadingProducts).toBe(false);
});
test('a forced missing product refresh removes stale detail and its live-purchase marker',async()=>{
  await shopifyStore.loadProducts();mockProduct.mockResolvedValue(null);
  await shopifyStore.loadProduct(base.handle,true);
  expect(shopifyStore.getState().products).toEqual([]);
  expect(shopifyStore.getState().liveProductHandles).toEqual([]);
});
