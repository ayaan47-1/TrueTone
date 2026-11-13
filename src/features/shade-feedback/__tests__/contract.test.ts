import { parseFeedback, parseCorrection, SERVER_FEEDBACK_ENABLED } from '../contract';
import { createFeedbackService } from '../service';

export const candidate = {position:1,variant_gid:'gid://shopify/ProductVariant/1',label_id:'00000000-0000-4000-8000-000000000001',label_revision:1,formula_version:'1',available_at_display:true};
export const event = {consent_receipt_id:'00000000-0000-4000-8000-000000000002',recommendation_id:'00000000-0000-4000-8000-000000000003',
  engine_version:'coarse-v1',catalog_as_of:'2026-11-12T01:00:00Z',estimated_variant_gid:candidate.variant_gid,
  estimated_label_id:candidate.label_id,estimated_label_revision:1,estimated_formula_version:'1',tried_variant_gid:candidate.variant_gid,
  depth_correction:'too_light',undertone_correction:'as_expected',outcome:null,displayed_at:'2026-11-12T01:00:00Z',candidates:[candidate]};

test('accepts bounded directional answers and rejects every extra nested or renamed field',()=>{
  expect(parseFeedback(event)).toEqual(event);
  for (const key of ['imageUri','scan_id','confidence','metadata','hidden_measurement','user_id','submitted_at']) {
    expect(()=>parseFeedback({...event,[key]:'forbidden'})).toThrow();
    expect(()=>parseFeedback({...event,candidates:[{...candidate,[key]:'forbidden'}]})).toThrow();
  }
  expect(()=>parseFeedback({...event,candidates:Array(4).fill(candidate)})).toThrow();
  expect(()=>parseFeedback({...event,tried_variant_gid:'gid://shopify/ProductVariant/2'})).toThrow();
  expect(()=>parseFeedback({...event,depth_correction:'not_sure',undertone_correction:'not_sure'})).toThrow();
  expect(()=>parseFeedback({...event,engine_version:'x'.repeat(65)})).toThrow();
  expect(()=>parseFeedback({...event,candidates:[candidate,{...candidate,position:1}]})).toThrow();
});

test('only bounded corrections/outcomes can be updated, without rewriting provenance',()=>{
  expect(parseCorrection({depth_correction:'too_dark',undertone_correction:'not_sure',outcome:'returned_other'}).outcome).toBe('returned_other');
  expect(()=>parseCorrection({depth_correction:'too_dark',undertone_correction:'not_sure',outcome:null,estimated_variant_gid:candidate.variant_gid})).toThrow();
});

test('server logging is off and declining consent makes no request, with no upload queue',async()=>{
  expect(SERVER_FEEDBACK_ENABLED).toBe(false);
  const rpc=jest.fn();
  const service=createFeedbackService(rpc);
  expect(await service.submit(event,false)).toEqual({kind:'disabled'});
  expect(await service.submit(event,true)).toEqual({kind:'disabled'});
  expect(rpc).not.toHaveBeenCalled();
});

test('reviewed future path sends only the first-party RPC allowlist, sanitizes failures and never retries automatically',async()=>{
  let service:ReturnType<typeof createFeedbackService>|undefined;
  const rpc=jest.fn().mockResolvedValue({data:'saved-id',error:null});
  jest.doMock('../flags',()=>({SERVER_FEEDBACK_ENABLED:true}));
  jest.isolateModules(()=>{service=require('../service').createFeedbackService(rpc);});
  jest.dontMock('../flags');
  if(!service) throw new Error('service not loaded');
  expect(await service.submit(event,false)).toEqual({kind:'disabled'});
  expect(rpc).not.toHaveBeenCalled();
  expect(await service.submit(event,true)).toEqual({kind:'saved'});
  expect(rpc).toHaveBeenCalledWith('record_shade_feedback',{p_event:event});
  rpc.mockResolvedValueOnce({data:null,error:{message:'sensitive detail'}});
  expect(await service.submit(event,true)).toEqual({kind:'unavailable'});
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(await service.submit({...event,hidden:'value'},true)).toEqual({kind:'unavailable'});
  expect(rpc).toHaveBeenCalledTimes(2);
});
