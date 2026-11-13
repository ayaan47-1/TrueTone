import {fireEvent,render,waitFor} from '@testing-library/react-native';
import type {ShopifyCart} from '../types';
import {PRODUCT_FIXTURE_NODE} from '../fixtures/products';
import {mapProductNode} from '../product-mapper';
const product=mapProductNode(PRODUCT_FIXTURE_NODE);
let mockCart:ShopifyCart,mockValidationFails=false;
const mockRequest=jest.fn(async()=>({nodes:[{...PRODUCT_FIXTURE_NODE.variants.nodes[1],product:PRODUCT_FIXTURE_NODE}]}));
const mockAdd=jest.fn(async()=>{
  mockCart={...mockCart,totalQuantity:1,lines:[{id:'added',quantity:1,merchandise:{...product.variants[1],product}}]};
  mockValidationFails=true;return mockCart;
});
const mockRemove=jest.fn(async(id:string)=>{
  mockCart={...mockCart,lines:mockCart.lines.filter(line=>line.id!==id)};
  mockCart={...mockCart,totalQuantity:mockCart.lines.reduce((n,line)=>n+line.quantity,0)};
  mockValidationFails=true;return mockCart;
});
const mockUpdate=jest.fn(async(id:string,quantity:number)=>{
  mockCart={...mockCart,lines:mockCart.lines.map(line=>line.id===id?{...line,quantity}:line),totalQuantity:quantity};
  mockValidationFails=true;return mockCart;
});
const mockPoint=jest.fn(async(id:string)=>{
  if(mockValidationFails) throw Error('transient approval read failure');
  return {id};
});
jest.mock('../client',()=>({createShopifyClient:()=>({request:mockRequest})}));
jest.mock('../env',()=>({readShopifyConfig:()=>({})}));
jest.mock('../shop-privacy',()=>({hasAcceptedShopPrivacy:()=>true}));
jest.mock('../use-present-checkout',()=>({usePresentCheckout:()=>jest.fn()}));
jest.mock('../cart-adapter',()=>({createCartAdapter:()=>({load:async()=>mockCart,add:mockAdd,remove:mockRemove,update:mockUpdate})}));
jest.mock('../../../../lib/supabase',()=>({SUPABASE_OFFLINE:false,DEMO_MODE:false}));
jest.mock('../../../match/product-catalog',()=>({catalog:[],readApprovedVariant:(id:string)=>mockPoint(id)}));
import {__setShopifyServicesForTests} from '../runtime';
import {__resetShopifyStoreForTests,shopifyStore} from '../shopify-store';
import {ShopifyBagScreen} from '../ui/ShopifyBagScreen';
beforeEach(()=>{
  __setShopifyServicesForTests(null);__resetShopifyStoreForTests();jest.clearAllMocks();mockValidationFails=false;
  mockCart={id:'cart',checkoutUrl:'https://checkout.example.invalid',subtotal:{amount:'30.00',currencyCode:'USD'},totalQuantity:0,lines:[]};
});
test('successful add survives a later validation failure; retry only validates and cannot add twice',async()=>{
  expect(await shopifyStore.addToCart(product.variants[1].id,1)).toBe(true);
  expect(shopifyStore.getState().cart?.totalQuantity).toBe(1);
  expect(shopifyStore.getState().error).toBeNull();
  const view=await render(<ShopifyBagScreen onShop={jest.fn()} />);
  await waitFor(()=>expect(view.getByRole('button',{name:'Check bag approval'})).not.toBeDisabled());
  expect(view.getByRole('button',{name:'Guest checkout · $30.00'})).toBeDisabled();
  await fireEvent.press(view.getByRole('button',{name:'Check bag approval'}));
  await waitFor(()=>expect(shopifyStore.getState().loadingCart).toBe(false));
  expect(shopifyStore.getState().cart?.totalQuantity).toBe(1);expect(mockAdd).toHaveBeenCalledTimes(1);
  mockValidationFails=false;
  await fireEvent.press(view.getByRole('button',{name:'Check bag approval'}));
  await waitFor(()=>expect(view.queryByRole('button',{name:'Check bag approval'})).toBeNull());
  expect(view.getByRole('button',{name:'Guest checkout · $30.00'})).not.toBeDisabled();expect(mockAdd).toHaveBeenCalledTimes(1);
});
test('successful removal is published even when validating the remaining line fails',async()=>{
  mockCart={...mockCart,totalQuantity:2,lines:[
    {id:'remove',quantity:1,merchandise:{...product.variants[1],product:{...product,title:'Removed shade'}}},
    {id:'keep',quantity:1,merchandise:{...product.variants[1],product:{...product,title:'Remaining shade'}}},
  ]};
  const view=await render(<ShopifyBagScreen onShop={jest.fn()} />);
  await waitFor(()=>expect(view.getByRole('button',{name:'Remove Removed shade'})).not.toBeDisabled());
  await fireEvent.press(view.getByRole('button',{name:'Remove Removed shade'}));
  await waitFor(()=>expect(view.queryByText('Removed shade')).toBeNull());
  expect(view.getByRole('button',{name:'Remove Remaining shade'})).not.toBeDisabled();
  expect(view.getByRole('button',{name:'Guest checkout · $30.00'})).toBeDisabled();
  expect(shopifyStore.getState().error).toBeNull();
  await fireEvent.press(view.getByRole('button',{name:'Check bag approval'}));
  await waitFor(()=>expect(shopifyStore.getState().loadingCart).toBe(false));
  expect(mockRemove).toHaveBeenCalledTimes(1);expect(shopifyStore.getState().cart?.lines.map(line=>line.id)).toEqual(['keep']);
});

test('a failed pre-add validation never invokes the mutation',async()=>{
  mockValidationFails=true;
  expect(await shopifyStore.addToCart(product.variants[1].id,1)).toBe(false);
  expect(mockAdd).not.toHaveBeenCalled();expect(shopifyStore.getState().cart).toBeNull();
});

test.each([1,3])('successful quantity change to %s remains published after validation failure',async quantity=>{
  mockCart={...mockCart,totalQuantity:2,lines:[{id:'change',quantity:2,merchandise:{...product.variants[1],product}}]};
  await shopifyStore.loadCart();await shopifyStore.updateLine('change',quantity);
  expect(shopifyStore.getState().cart?.lines[0].quantity).toBe(quantity);
  expect(shopifyStore.getState().cart?.approvalStatus).toBe('unverified');expect(shopifyStore.getState().error).toBeNull();
  await shopifyStore.loadCart();expect(mockUpdate).toHaveBeenCalledTimes(1);
});
