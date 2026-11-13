import { cleanup, render, waitFor } from '@testing-library/react-native';
jest.unmock('../../match/product-catalog');
const mockRange=jest.fn();
jest.mock('../../../lib/supabase',()=>({DEMO_MODE:false,SUPABASE_OFFLINE:false,supabase:{from:()=>({select:()=>({order:()=>({range:mockRange})})})}}));
import { ProductDetail } from '../../shop/ProductDetail';
jest.mock('../../../components/ui/use-insets',()=>({useInsets:()=>({top:47,bottom:34,left:0,right:0})}));
import { CatalogueNotice } from '../CatalogueNotice';
afterEach(async()=>{await cleanup();});

test('live product detail uses only its actual shade and does not invent swatches, ratings or sizes',async()=>{
  mockRange.mockResolvedValue({error:null,data:[{
    variant_gid:'gid://shopify/ProductVariant/1',product_gid:'gid://shopify/Product/1',vendor:'Brand',shade_name:'Neutral 5',
    formula_key:'brand:formula',formula_version:'1',label_id:'00000000-0000-4000-8000-000000000001',price:30,currency:'USD',
    depth_band:5,brand_depth_rank:null,base_undertone:'neutral',undertone_modifiers:[],depth_confidence:'B',undertone_confidence:'B',
    rank_confidence:'X',modifier_confidence:{},finish:null,coverage:null,lab_status:'unmeasured',lab_l:null,lab_a:null,lab_b:null,
  }]});
  const view=await render(<ProductDetail productId="gid://shopify/ProductVariant/1" onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />);
  await waitFor(()=>expect(view.getByText('Brand Neutral 5')).toBeTruthy());
  expect(view.getByText('Finish not specified')).toBeTruthy();
  expect(view.getByTestId('product-detail-shell').props.className).toContain('bg-mist-50');
  expect(view.getByTestId('product-detail-cta')).toHaveStyle({paddingBottom:50});
  expect(view.getByRole('button',{name:'Back'})).toHaveStyle({position:'absolute',top:55});
  expect(view.getByRole('image',{name:'Product image unavailable, Brand Neutral 5'})).toBeTruthy();
  expect(view.queryByText('Sample')).toBeNull();
  expect(view.queryByText('30 ml')).toBeNull();
  expect(view.queryAllByTestId(/product-art-/)).toHaveLength(0);
  await view.rerender(<ProductDetail productId="gid://shopify/ProductVariant/2" onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByText('This shade is unavailable')).toBeTruthy();
  expect(view.queryByText('Brand Neutral 5')).toBeNull();
});

test('empty and offline catalogue states are explicit and retryable',async()=>{
  const empty=await render(<CatalogueNotice state={{status:'empty',products:[],previousProducts:[]}} />);
  expect(empty.getByText('No verified shades available')).toBeTruthy();
  await empty.unmount();
  const offline=await render(<CatalogueNotice state={{status:'offline',products:[],previousProducts:[]}} />);
  expect(offline.getByText('Catalogue unavailable')).toBeTruthy();
  expect(offline.getByRole('button',{name:'Try again'})).toBeTruthy();
});
