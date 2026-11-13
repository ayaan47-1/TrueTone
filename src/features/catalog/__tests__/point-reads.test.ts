jest.unmock('../../match/product-catalog');
let mockOffline=false,mockDemo=false;
const mockLimit=jest.fn();
const mockGt=jest.fn(()=>({limit:mockLimit}));
const mockOrder=jest.fn(()=>({limit:mockLimit,gt:mockGt}));
const mockEq=jest.fn((_column:string,_value:string)=>({limit:mockLimit,order:mockOrder}));
const mockSelect=jest.fn(()=>({eq:mockEq,order:mockOrder}));
const mockFrom=jest.fn(()=>({select:mockSelect}));
jest.mock('../../../lib/supabase',()=>({get SUPABASE_OFFLINE(){return mockOffline;},get DEMO_MODE(){return mockDemo;},supabase:{from:()=>mockFrom(),rpc:jest.fn()}}));
import { readApprovedVariant,readApprovedProduct } from '../../match/product-catalog';
const row=(id=1)=>({variant_gid:`gid://shopify/ProductVariant/${id}`,product_gid:'gid://shopify/Product/1',label_id:'00000000-0000-4000-8000-000000000001',vendor:'Synthetic',shade_name:'Neutral',formula_key:'synthetic',formula_version:'1',price:30,currency:'USD',depth_band:5,brand_depth_rank:null,base_undertone:'neutral',undertone_modifiers:[],depth_confidence:'B',rank_confidence:'X',undertone_confidence:'B',modifier_confidence:{},finish:'natural',coverage:'medium',lab_status:'unmeasured',lab_l:null,lab_a:null,lab_b:null});
beforeEach(()=>{jest.clearAllMocks();mockOffline=false;mockDemo=false;});
test('one approved selection uses an equality filter and limit one',async()=>{
  mockLimit.mockResolvedValue({data:[row(2)],error:null});
  expect((await readApprovedVariant(row(2).variant_gid))?.id).toBe(row(2).variant_gid);
  expect(mockEq).toHaveBeenCalledWith('variant_gid',row(2).variant_gid);
  expect(mockLimit).toHaveBeenCalledWith(1);
});
test('a removed or malformed selection never becomes a purchasable fallback',async()=>{
  mockLimit.mockResolvedValue({data:[],error:null});
  expect(await readApprovedVariant(row(2).variant_gid)).toBeNull();
  jest.clearAllMocks();expect(await readApprovedVariant('not-a-variant')).toBeNull();expect(mockFrom).not.toHaveBeenCalled();
});
test.each(['offline','demo'])('%s point/product reads make no Supabase requests',async mode=>{
  mockOffline=mode==='offline';mockDemo=mode==='demo';
  expect(await readApprovedVariant(row(1).variant_gid)).toBeNull();
  expect((await readApprovedProduct(row(1).product_gid,null)).products).toEqual([]);
  expect(mockFrom).not.toHaveBeenCalled();
});
test('product options are scoped and keyset-paged rather than scanning every approved shade',async()=>{
  mockLimit.mockResolvedValue({data:Array.from({length:31},(_,i)=>row(i+1)),error:null});
  const page=await readApprovedProduct(row(1).product_gid,'gid://shopify/ProductVariant/0');
  expect(page.products).toHaveLength(30);expect(page.nextCursor).toBe(row(30).variant_gid);
  expect(mockEq).toHaveBeenCalledWith('product_gid',row(1).product_gid);
  expect(mockGt).toHaveBeenCalledWith('variant_gid','gid://shopify/ProductVariant/0');
  expect(mockLimit).toHaveBeenCalledWith(31);
});
