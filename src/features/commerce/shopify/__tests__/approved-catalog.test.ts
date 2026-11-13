import { createApprovedShopifyCatalog } from '../approved-catalog';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import {catalog as demo} from '../../../match/demo-product-catalog';
const productPage=async()=>({products:[],nextCursor:null});

test('Shopify display metadata is joined only to approved variant IDs',async()=>{
  const request=jest.fn().mockResolvedValue({nodes:PRODUCT_FIXTURE_NODE.variants.nodes.map(variant=>({...variant,product:PRODUCT_FIXTURE_NODE}))});
  const source=createApprovedShopifyCatalog({request},async()=>[{id:'gid://shopify/ProductVariant/2'}],productPage);
  const result=await source.list();
  expect(result).toHaveLength(1);
  expect(result[0].variants.map(variant=>variant.id)).toEqual(['gid://shopify/ProductVariant/2']);
  expect(request).toHaveBeenCalledWith(expect.stringContaining('visitorConsent'),{ids:['gid://shopify/ProductVariant/2']});
});

test('empty approved view never asks Shopify for synthetic replacements',async()=>{
  const request=jest.fn();
  expect(await createApprovedShopifyCatalog({request},async()=>[],productPage).list()).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});

test('view failure is propagated instead of falling back to an unreviewed Storefront list',async()=>{
  const request=jest.fn();
  const source=createApprovedShopifyCatalog({request},async()=>{throw new Error('offline');},productPage);
  await expect(source.list()).rejects.toThrow('offline');
  expect(request).not.toHaveBeenCalled();
});

 test.each(['price', 'compareAtPrice'])('rejects CAD %s before mapping an approved variant', async (field) => {
  const variant = {...PRODUCT_FIXTURE_NODE.variants.nodes[1], [field]: {amount:'30.00',currencyCode:'CAD'}, product:PRODUCT_FIXTURE_NODE};
  const request=jest.fn().mockResolvedValue({nodes:[variant]});
  expect(await createApprovedShopifyCatalog({request},async()=>[{id:variant.id}],productPage).list()).toEqual([]);
});

test('product detail resolves only its scoped approved options page, including a continuation cursor',async()=>{
  const variant=PRODUCT_FIXTURE_NODE.variants.nodes[1];
  const approved=jest.fn().mockResolvedValue(Array.from({length:1000},(_,n)=>({id:`gid://shopify/ProductVariant/${n+100}`})));
  const scoped=jest.fn().mockResolvedValue({products:[{...demo[0],id:variant.id}],nextCursor:variant.id});
  const request=jest.fn().mockResolvedValueOnce({product:{id:PRODUCT_FIXTURE_NODE.id}}).mockResolvedValueOnce({nodes:[{...variant,product:PRODUCT_FIXTURE_NODE}]});
  const source=createApprovedShopifyCatalog({request},approved,scoped);
  const result=await source.getByHandle(PRODUCT_FIXTURE_NODE.handle,'gid://shopify/ProductVariant/0');
  expect(approved).not.toHaveBeenCalled();
  expect(scoped).toHaveBeenCalledWith(PRODUCT_FIXTURE_NODE.id,'gid://shopify/ProductVariant/0');
  expect(request).toHaveBeenNthCalledWith(2,expect.stringContaining('visitorConsent'),{ids:[variant.id]});
  expect(result?.variants.map(value=>value.id)).toEqual([variant.id]);
  expect(result?.optionsPage?.nextCursor).toBe(variant.id);
});

test('a missing product identity does not fall back to a full catalogue scan',async()=>{
  const approved=jest.fn(),scoped=jest.fn(),request=jest.fn().mockResolvedValue({product:null});
  expect(await createApprovedShopifyCatalog({request},approved,scoped).getByHandle('gone')).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);expect(approved).not.toHaveBeenCalled();expect(scoped).not.toHaveBeenCalled();
});
