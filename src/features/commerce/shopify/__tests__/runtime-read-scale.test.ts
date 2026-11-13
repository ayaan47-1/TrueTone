const mockRequest=jest.fn(),mockAdd=jest.fn(),mockRefresh=jest.fn(),mockVariant=jest.fn();
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({add:mockAdd})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false}));
jest.mock('../../../match/product-catalog',()=>({refreshCatalogue:(force:boolean)=>mockRefresh(force),
  getCatalogueState:()=>({status:'ready',products:Array.from({length:500},(_,n)=>({id:`gid://shopify/ProductVariant/${n+2}`}))}),
  readApprovedVariant:(id:string)=>mockVariant(id),readApprovedProduct:async()=>({products:[],nextCursor:null})}));
import { getShopifyServices,__setShopifyServicesForTests } from '../runtime';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
beforeEach(()=>{jest.clearAllMocks();__setShopifyServicesForTests(null);});
test('cart add validates one selected variant without downloading all approved IDs',async()=>{
  const variant={...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE};
  mockVariant.mockResolvedValue({id:variant.id});mockRequest.mockResolvedValue({nodes:[variant]});
  await getShopifyServices().cart.add(variant.id,1);
  expect(mockVariant).toHaveBeenCalledWith(variant.id);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining('visitorConsent'),{ids:[variant.id]});
  expect(mockAdd).toHaveBeenCalledWith(variant.id,1);
});
test('a removed selected shade cannot cause Shopify traffic or a cart mutation',async()=>{
  mockVariant.mockResolvedValue(null);
  await expect(getShopifyServices().cart.add('gid://shopify/ProductVariant/2',1)).rejects.toThrow('shade unavailable');
  expect(mockRequest).not.toHaveBeenCalled();expect(mockAdd).not.toHaveBeenCalled();
});
