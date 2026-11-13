import {fireEvent,render,waitFor} from '@testing-library/react-native';
import type {ShopifyCart} from '../types';
import {PRODUCT_FIXTURE_NODE} from '../fixtures/products';
import {mapProductNode} from '../product-mapper';
const product=mapProductNode(PRODUCT_FIXTURE_NODE);
let mockCart:ShopifyCart;
const mockRemove=jest.fn(async(id:string)=>{
  mockCart={...mockCart,lines:mockCart.lines.filter(line=>line.id!==id)};
  mockCart={...mockCart,totalQuantity:mockCart.lines.reduce((sum,line)=>sum+line.quantity,0)};
  return mockCart;
});
const mockUpdate=jest.fn(async(id:string,quantity:number)=>{
  mockCart={...mockCart,lines:mockCart.lines.map(line=>line.id===id?{...line,quantity}:line)};
  mockCart={...mockCart,totalQuantity:mockCart.lines.reduce((sum,line)=>sum+line.quantity,0)};
  return mockCart;
});
jest.mock('../client',()=>({createShopifyClient:()=>({request:jest.fn()})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../shop-privacy',()=>({hasAcceptedShopPrivacy:()=>true}));
jest.mock('../use-present-checkout',()=>({usePresentCheckout:()=>jest.fn()}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({load:async()=>mockCart,update:mockUpdate,remove:mockRemove})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false,DEMO_MODE:false}));
jest.mock('../../../match/product-catalog',()=>({catalog:[],readApprovedVariant:async()=>null}));
import {__setShopifyServicesForTests} from '../runtime';
import {__resetShopifyStoreForTests,shopifyStore} from '../shopify-store';
import {ShopifyBagScreen} from '../ui/ShopifyBagScreen';
beforeEach(()=>{
  __setShopifyServicesForTests(null);__resetShopifyStoreForTests();
  mockCart={id:'cart',checkoutUrl:'https://checkout.example.invalid',subtotal:{amount:'30.00',currencyCode:'USD'},totalQuantity:3,
    lines:[{id:'first',quantity:2,merchandise:{...product.variants[1],product:{...product,title:'First shade'}}},
      {id:'second',quantity:1,merchandise:{...product.variants[1],id:'gid://shopify/ProductVariant/99',product:{...product,title:'Other shade'}}}]};
});
test.each(['remove','decrease'])('%s does not clear another invalid line warning or unlock checkout',async operation=>{
  const view=await render(<ShopifyBagScreen onShop={jest.fn()} />);
  await waitFor(()=>expect(view.getAllByText('This shade is no longer available for checkout. Remove it from your bag.')).toHaveLength(2));
  await fireEvent.press(view.getByRole('button',{name:operation==='remove'?'Remove First shade':'Decrease First shade'}));
  await waitFor(()=>expect(shopifyStore.getState().loadingCart).toBe(false));
  expect(shopifyStore.getState().cart?.unavailableVariantIds).toContain('gid://shopify/ProductVariant/99');
  expect(view.getAllByText('This shade is no longer available for checkout. Remove it from your bag.')).toHaveLength(operation==='remove'?1:2);
  expect(view.getByRole('button',{name:'Remove Other shade'})).not.toBeDisabled();
  expect(view.getByRole('button',{name:'Guest checkout · $30.00'})).toBeDisabled();
});
