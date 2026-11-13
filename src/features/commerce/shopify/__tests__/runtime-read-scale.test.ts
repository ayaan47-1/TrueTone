const mockRequest=jest.fn(),mockAdd=jest.fn(),mockRefresh=jest.fn(),mockVariant=jest.fn(),mockLoad=jest.fn(),mockUpdate=jest.fn();
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({add:mockAdd,load:mockLoad,update:mockUpdate})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false}));
jest.mock('../../../match/product-catalog',()=>({refreshCatalogue:(force:boolean)=>mockRefresh(force),
  getCatalogueState:()=>({status:'ready',products:Array.from({length:500},(_,n)=>({id:`gid://shopify/ProductVariant/${n+2}`}))}),
  readApprovedVariant:(id:string)=>mockVariant(id),readApprovedProduct:async()=>({products:[],nextCursor:null})}));
import { getShopifyServices,__setShopifyServicesForTests } from '../runtime';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';
const product=mapProductNode(PRODUCT_FIXTURE_NODE);
const cart={id:'cart',checkoutUrl:'https://checkout.example.invalid',subtotal:{amount:'30.00',currencyCode:'USD'},totalQuantity:1,
  lines:[{id:'line',quantity:1,merchandise:{...product.variants[1],product}}]};
beforeEach(()=>{jest.clearAllMocks();__setShopifyServicesForTests(null);});
test('cart add validates one selected variant without downloading all approved IDs',async()=>{
  const variant={...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE};
  mockVariant.mockResolvedValue({id:variant.id});mockRequest.mockResolvedValue({nodes:[variant]});
  mockAdd.mockResolvedValue(cart);
  await getShopifyServices().cart.add(variant.id,1);
  expect(mockVariant).toHaveBeenCalledWith(variant.id);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockRequest).toHaveBeenCalledTimes(2);
  expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining('visitorConsent'),{ids:[variant.id]});
  expect(mockAdd).toHaveBeenCalledWith(variant.id,1);
});
test('adding a valid shade also retains flags for invalid lines already in the returned bag',async()=>{
  const selected=cart.lines[0].merchandise.id;
  mockVariant.mockImplementation(async(id:string)=>id===selected?{id}:null);
  mockRequest.mockResolvedValue({nodes:[{...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE}]});
  mockAdd.mockResolvedValue({...cart,totalQuantity:2,lines:[cart.lines[0],{...cart.lines[0],id:'old-line',merchandise:{...cart.lines[0].merchandise,id:'gid://shopify/ProductVariant/99'}}]});
  expect((await getShopifyServices().cart.add(selected,1)).unavailableVariantIds).toEqual(['gid://shopify/ProductVariant/99']);
  expect(mockRefresh).not.toHaveBeenCalled();
});
test('a removed selected shade cannot cause Shopify traffic or a cart mutation',async()=>{
  mockVariant.mockResolvedValue(null);
  await expect(getShopifyServices().cart.add('gid://shopify/ProductVariant/2',1)).rejects.toThrow('shade unavailable');
  expect(mockRequest).not.toHaveBeenCalled();expect(mockAdd).not.toHaveBeenCalled();
});
test('loading a bag flags a previously added shade whose approval was removed',async()=>{
  mockLoad.mockResolvedValue(cart);mockVariant.mockResolvedValue(null);
  const result=await getShopifyServices().cart.load();
  expect(result.unavailableVariantIds).toEqual([cart.lines[0].merchandise.id]);
  expect(mockRequest).not.toHaveBeenCalled();
});
test('approval read errors retain the fresh cart as unverified so checkout stays blocked',async()=>{
  mockLoad.mockResolvedValue(cart);mockVariant.mockRejectedValue(Error('offline'));
  const result=await getShopifyServices().cart.load();
  expect(result.id).toBe(cart.id);expect(result.approvalStatus).toBe('unverified');
});
test('a non-USD cart cannot be validated for checkout even if its variant is approved',async()=>{
  mockLoad.mockResolvedValue({...cart,subtotal:{amount:'30.00',currencyCode:'CAD'}});
  mockVariant.mockResolvedValue({id:cart.lines[0].merchandise.id});
  mockRequest.mockResolvedValue({nodes:[{...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE}]});
  expect((await getShopifyServices().cart.load()).approvalStatus).toBe('unverified');
});
test('increasing an existing line revalidates approval, while decreasing stays possible',async()=>{
  mockLoad.mockResolvedValue(cart);mockVariant.mockResolvedValue(null);
  await expect(getShopifyServices().cart.update('line',2)).rejects.toThrow('shade unavailable');
  expect(mockUpdate).not.toHaveBeenCalled();
  mockUpdate.mockResolvedValue(cart);await getShopifyServices().cart.update('line',1);
  expect(mockUpdate).toHaveBeenCalledWith('line',1);
});
