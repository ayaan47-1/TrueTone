import { createLocalFeedback } from '../local';

test('saves only an explicit on-device answer, isolates owners and deletes it independently',async()=>{
  const values=new Map<string,string>();
  const storage={getAllKeys:async()=>[...values.keys()],getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
  const store=createLocalFeedback(storage);
  const answer={variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_dark',undertone_correction:'as_expected',outcome:null};
  await store.save('owner-a',answer);
  expect((await store.list('owner-a'))[0]).toMatchObject(answer);
  expect(await store.list('owner-b')).toEqual([]);
  await expect(store.save('owner-a',{...answer,hidden:'private'})).rejects.toThrow();
  expect(await store.clear('owner-a')).toBe(1);
  expect(await store.list('owner-a')).toEqual([]);
});

test('declining saves nothing; a failed local write does not become an upload retry',async()=>{
  const setItem=jest.fn().mockRejectedValue(Error('storage failure'));
  const store=createLocalFeedback({getAllKeys:async()=>[],getItem:async()=>null,setItem,removeItem:async()=>undefined});
  expect(await store.list('owner')).toEqual([]);
  expect(setItem).not.toHaveBeenCalled();
  await expect(store.save('owner',{variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_light',undertone_correction:'as_expected',outcome:null})).rejects.toThrow();
  expect(await store.list('owner')).toEqual([]);
});

test('expired answers are physically removed on read and a global wipe clears all owners',async()=>{
  const values=new Map<string,string>();
  const storage={getAllKeys:async()=>[...values.keys()],getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
  const store=createLocalFeedback(storage);
  values.set('truetone.shadeFeedback.owner',JSON.stringify([{variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_light',undertone_correction:'as_expected',outcome:null,submitted_at:'2020-01-01T00:00:00Z'}]));
  expect(await store.list('owner')).toEqual([]);
  expect(values.has('truetone.shadeFeedback.owner')).toBe(false);
  await store.save('owner-a',{variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_light',undertone_correction:'as_expected',outcome:null});
  values.set('unrelated','keep');
  await store.clearAll();
  expect([...values.entries()]).toEqual([['unrelated','keep']]);
  values.set('truetone.shadeFeedback.owner','corrupt');
  await store.clear('owner');
  expect(values.has('truetone.shadeFeedback.owner')).toBe(false);
});
