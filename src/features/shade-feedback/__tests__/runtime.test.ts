const mockRpc=jest.fn();
const mockValues=new Map<string,string>();
jest.mock('../../../lib/supabase',()=>({SUPABASE_OFFLINE:false,supabase:{rpc:(...args:unknown[])=>mockRpc(...args)}}));
jest.mock('../../../lib/encrypted-storage',()=>({encryptedStorage:{getAllKeys:async()=>[...mockValues.keys()],getItem:async(key:string)=>mockValues.get(key)??null,setItem:async(key:string,value:string)=>{mockValues.set(key,value);},removeItem:async(key:string)=>{mockValues.delete(key);}}}));
import { localFeedback, clearAllLocalFeedback, deleteOwnedFeedback, feedbackService } from '../runtime';

test('runtime keeps default answers local and performs only explicit first-party reads/deletions',async()=>{
  const answer={variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_light',undertone_correction:'as_expected',outcome:null};
  await localFeedback.save('owner',answer);
  expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({data:{events:[],candidates:[]},error:null});
  expect(await feedbackService.list()).toEqual({events:[],candidates:[]});
  expect(mockRpc).toHaveBeenLastCalledWith('list_shade_feedback',{p_offset:0});
  mockRpc.mockResolvedValueOnce({data:0,error:null});
  await deleteOwnedFeedback('owner');
  expect(await localFeedback.list('owner')).toEqual([]);
  mockRpc.mockResolvedValueOnce({data:null,error:null});
  await feedbackService.withdraw();
  expect(mockRpc).toHaveBeenLastCalledWith('set_shade_feedback_consent',{p_action:'withdrawn'});
  await localFeedback.save('owner',answer);
  await clearAllLocalFeedback();
  expect(await localFeedback.list('owner')).toEqual([]);
  mockRpc.mockResolvedValue({data:null,error:{message:'private detail'}});
  await expect(feedbackService.list()).rejects.toThrow('Could not read feedback');
  await expect(feedbackService.clear()).rejects.toThrow('Could not delete feedback');
  await expect(feedbackService.withdraw()).rejects.toThrow('Could not withdraw optional consent');
});
