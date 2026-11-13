const mockRequest=jest.fn();
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false}));
jest.mock('../../../match/product-catalog',()=>({refreshCatalogue:async()=>{},getCatalogueState:()=>({status:'demo',products:[]}),readApprovedProduct:async()=>({products:[],nextCursor:null}),readApprovedVariant:async()=>null}));
import { getShopifyServices,__setShopifyServicesForTests } from '../runtime';
test('demo product detail never queries a real Shopify identity',async()=>{
  __setShopifyServicesForTests(null);
  await expect(getShopifyServices().catalog.getByHandle('synthetic')).rejects.toThrow();
  expect(mockRequest).not.toHaveBeenCalled();
});
