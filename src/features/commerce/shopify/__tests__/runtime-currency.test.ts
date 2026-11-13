const mockRequest=jest.fn();
const mockAdd=jest.fn();
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({add:mockAdd})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false}));
jest.mock('../../../match/product-catalog',()=>({readApprovedVariant:async(id:string)=>({id}),readApprovedProduct:async()=>({products:[],nextCursor:null}),refreshCatalogue:async()=>{},getCatalogueState:()=>({status:'ready',products:[{id:'gid://shopify/ProductVariant/2'}]})}));
import { getShopifyServices, __setShopifyServicesForTests } from '../runtime';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import {mapProductNode} from '../product-mapper';
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
 const product=mapProductNode(PRODUCT_FIXTURE_NODE);
 mockAdd.mockResolvedValue({id:'cart',checkoutUrl:'https://checkout.example.invalid',totalQuantity:1,
   subtotal:{amount:'24.00',currencyCode:'USD'},lines:[{id:'line',quantity:1,merchandise:{...product.variants[1],product}}]});
 await getShopifyServices().cart.add(variant.id,1);
 expect(mockAdd).toHaveBeenCalledWith(variant.id,1);
});
