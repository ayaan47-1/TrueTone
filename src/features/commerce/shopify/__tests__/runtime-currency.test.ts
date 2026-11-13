const mockRequest=jest.fn();
const mockAdd=jest.fn();
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({add:mockAdd})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false}));
jest.mock('../../../match/product-catalog',()=>({refreshCatalogue:async()=>{},getCatalogueState:()=>({status:'ready',products:[{id:'gid://shopify/ProductVariant/2'}]})}));
import { getShopifyServices, __setShopifyServicesForTests } from '../runtime';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
beforeEach(()=>{jest.clearAllMocks();__setShopifyServicesForTests(null);});
test.each(['price','compareAtPrice'])('direct add rechecks Storefront USD %s before cart mutation',async field=>{
 const variant={...PRODUCT_FIXTURE_NODE.variants.nodes[1],[field]:{amount:'30.00',currencyCode:'CAD'},product:PRODUCT_FIXTURE_NODE};
 mockRequest.mockResolvedValue({nodes:[variant]});
 await expect(getShopifyServices().cart.add(variant.id,1)).rejects.toThrow('shade unavailable');
 expect(mockAdd).not.toHaveBeenCalled();
});
test('direct add permits an available approved USD variant',async()=>{
 const variant={...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE};
 mockRequest.mockResolvedValue({nodes:[variant]});
 await getShopifyServices().cart.add(variant.id,1);
 expect(mockAdd).toHaveBeenCalledWith(variant.id,1);
});
