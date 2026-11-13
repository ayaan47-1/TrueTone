import { fireEvent,render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';
const mockNext=jest.fn(),mockPrevious=jest.fn(),mockOptions=jest.fn();
const mockProduct={...mapProductNode(PRODUCT_FIXTURE_NODE),optionsPage:{nextCursor:'gid://shopify/ProductVariant/2'}};
jest.mock('../shop-privacy',()=>({hasAcceptedShopPrivacy:()=>true}));
jest.mock('../../../match/product-catalog',()=>({catalogueIsDemo:false,refreshCatalogue:async()=>{},loadMoreCatalogue:()=>mockNext(),loadPreviousCatalogue:()=>mockPrevious(),
  useProductCatalogue:()=>({status:'ready',products:mockProduct.variants.map(variant=>({id:variant.id})),previousProducts:[],hasMore:true,hasPrevious:true})}));
jest.mock('../shopify-store',()=>({useShopifyStore:()=>({products:[mockProduct],liveProductHandles:[mockProduct.handle]}),shopifyStore:{loadProducts:jest.fn(),loadProduct:jest.fn(),loadMoreOptions:(handle:string)=>mockOptions(handle)}}));
import { ShopifyShopScreen } from '../ui/ShopifyShopScreen';
import { ShopifyProductScreen } from '../ui/ShopifyProductScreen';
test('shop exposes next and previous visible catalogue pages',async()=>{
  const view=await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  await fireEvent.press(view.getByText('Next shades'));await fireEvent.press(view.getByText('Previous shades'));
  expect(mockNext).toHaveBeenCalledTimes(1);expect(mockPrevious).toHaveBeenCalledTimes(1);
});
test('product options request only the next scoped options page',async()=>{
  const view=await render(<ShopifyProductScreen handle={mockProduct.handle} onBack={jest.fn()} onAdded={jest.fn()} />);
  await fireEvent.press(view.getByText('More shade options'));
  expect(mockOptions).toHaveBeenCalledWith(mockProduct.handle);
});
