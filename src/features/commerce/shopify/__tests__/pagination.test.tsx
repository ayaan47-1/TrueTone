import { fireEvent,render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';
import {AccessibilityInfo,ScrollView} from 'react-native';
const mockNext=jest.fn(),mockPrevious=jest.fn(),mockOptions=jest.fn();
const mockProduct={...mapProductNode(PRODUCT_FIXTURE_NODE),optionsPage:{nextCursor:'gid://shopify/ProductVariant/2'}};
let mockStart=1,mockLoading=false;
jest.mock('../shop-privacy',()=>({hasAcceptedShopPrivacy:()=>true}));
jest.mock('../../../match/product-catalog',()=>({catalogueIsDemo:false,refreshCatalogue:async()=>{},loadMoreCatalogue:()=>mockNext(),loadPreviousCatalogue:()=>mockPrevious(),
  useProductCatalogue:()=>({status:'ready',products:mockProduct.variants.map(variant=>({id:variant.id})),previousProducts:[],hasMore:true,hasPrevious:true,rangeStart:mockStart,rangeEnd:mockStart+1})}));
jest.mock('../shopify-store',()=>({useShopifyStore:()=>({products:[mockProduct],liveProductHandles:[mockProduct.handle],loadingProducts:mockLoading}),shopifyStore:{loadProducts:jest.fn(),loadProduct:jest.fn(),loadMoreOptions:(handle:string)=>mockOptions(handle)}}));
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
test('new ranges are visible and announced after a successful page change',async()=>{
  const announce=jest.spyOn(AccessibilityInfo,'announceForAccessibility').mockImplementation(()=>{});
  const focus=jest.spyOn(AccessibilityInfo,'setAccessibilityFocus').mockImplementation(()=>{});
  const owner=jest.requireActual<typeof import('react-native')>('react-native');
  const node=jest.spyOn(owner,'findNodeHandle').mockReturnValue(37);
  const scroll=jest.spyOn(ScrollView.prototype,'scrollTo').mockImplementation(()=>{});
  mockStart=1;
  const view=await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  expect(view.getByText('Shades 1-2')).toBeTruthy();
  mockStart=31;await view.rerender(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  expect(view.getByText('Shades 31-32')).toBeTruthy();expect(announce).toHaveBeenCalledWith('Shades 31-32');
  expect(scroll).toHaveBeenCalledWith({y:0,animated:false});expect(focus).toHaveBeenCalledWith(37);
  announce.mockRestore();focus.mockRestore();node.mockRestore();scroll.mockRestore();mockStart=1;
});
test('option loading names the work in progress',async()=>{
  mockLoading=true;
  const view=await render(<ShopifyProductScreen handle={mockProduct.handle} onBack={jest.fn()} onAdded={jest.fn()} />);
  expect(view.getByRole('button',{name:'Loading more shade options…'})).toBeDisabled();mockLoading=false;
});
