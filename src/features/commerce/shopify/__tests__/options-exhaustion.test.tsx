import {fireEvent,render,waitFor} from '@testing-library/react-native';
import {PRODUCT_FIXTURE_NODE} from '../fixtures/products';
import {mapProductNode} from '../product-mapper';
import {createApprovedShopifyCatalog} from '../approved-catalog';
import {createCartAdapter} from '../cart-adapter';
import {catalog as demo} from '../../../match/demo-product-catalog';
const mockProduct={...mapProductNode(PRODUCT_FIXTURE_NODE),variants:[mapProductNode(PRODUCT_FIXTURE_NODE).variants[1]],optionsPage:{nextCursor:'terminal'}};
jest.mock('../shop-privacy',()=>({hasAcceptedShopPrivacy:()=>true}));
jest.mock('../../../match/product-catalog',()=>({catalogueIsDemo:false,useProductCatalogue:()=>({status:'ready',products:mockProduct.variants,previousProducts:[]})}));
import {__setShopifyServicesForTests} from '../runtime';
import {__resetShopifyStoreForTests,shopifyStore} from '../shopify-store';
import {ShopifyProductScreen} from '../ui/ShopifyProductScreen';
test('More hides on a sold-out terminal page while the shown options stay',async()=>{
  __resetShopifyStoreForTests();
  const request=jest.fn().mockResolvedValueOnce({product:PRODUCT_FIXTURE_NODE})
    .mockResolvedValueOnce({nodes:[{...PRODUCT_FIXTURE_NODE.variants.nodes[1],availableForSale:false,product:PRODUCT_FIXTURE_NODE}]});
  const terminal=createApprovedShopifyCatalog({request},async()=>[],async()=>({products:[{...demo[0],id:mockProduct.variants[0].id}],nextCursor:null}));
  __setShopifyServicesForTests({catalog:{list:async()=>[],getByHandle:async(handle,after)=>after?terminal.getByHandle(handle,after):mockProduct},
    catalogCache:{read:async()=>null,write:async()=>{}},cart:createCartAdapter({request:jest.fn()})});
  const view=await render(<ShopifyProductScreen handle={mockProduct.handle} onBack={jest.fn()} onAdded={jest.fn()} />);
  await waitFor(()=>expect(view.getByText('More shade options')).not.toBeDisabled());
  await fireEvent.press(view.getByText('More shade options'));
  await waitFor(()=>expect(shopifyStore.getState().loadingProducts).toBe(false));
  expect(view.queryByText('More shade options')).toBeNull();
  expect(view.getByText(mockProduct.title)).toBeTruthy();
  expect(shopifyStore.getState().products[0].variants.map(v=>v.id)).toEqual([mockProduct.variants[0].id]);
  expect(shopifyStore.getState().products[0].optionsPage?.nextCursor).toBeNull();
  await view.unmount();__setShopifyServicesForTests(null);
});
