import { createApprovedShopifyCatalog } from '../approved-catalog';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';

test('Shopify display metadata is joined only to approved variant IDs',async()=>{
  const request=jest.fn().mockResolvedValue({nodes:PRODUCT_FIXTURE_NODE.variants.nodes.map(variant=>({...variant,product:PRODUCT_FIXTURE_NODE}))});
  const source=createApprovedShopifyCatalog({request},async()=>[{id:'gid://shopify/ProductVariant/2'}]);
  const result=await source.list();
  expect(result).toHaveLength(1);
  expect(result[0].variants.map(variant=>variant.id)).toEqual(['gid://shopify/ProductVariant/2']);
  expect(request).toHaveBeenCalledWith(expect.stringContaining('visitorConsent'),{ids:['gid://shopify/ProductVariant/2']});
});

test('empty approved view never asks Shopify for synthetic replacements',async()=>{
  const request=jest.fn();
  expect(await createApprovedShopifyCatalog({request},async()=>[]).list()).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});

test('view failure is propagated instead of falling back to an unreviewed Storefront list',async()=>{
  const request=jest.fn();
  const source=createApprovedShopifyCatalog({request},async()=>{throw new Error('offline');});
  await expect(source.list()).rejects.toThrow('offline');
  expect(request).not.toHaveBeenCalled();
});

 test.each(['price', 'compareAtPrice'])('rejects CAD %s before mapping an approved variant', async (field) => {
  const variant = {...PRODUCT_FIXTURE_NODE.variants.nodes[1], [field]: {amount:'30.00',currencyCode:'CAD'}, product:PRODUCT_FIXTURE_NODE};
  const request=jest.fn().mockResolvedValue({nodes:[variant]});
  expect(await createApprovedShopifyCatalog({request},async()=>[{id:variant.id}]).list()).toEqual([]);
});
