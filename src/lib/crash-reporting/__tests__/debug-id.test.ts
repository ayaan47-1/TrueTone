import type { DebugImage, Envelope, ErrorEvent } from '@sentry/core';
import { guardCrashTransport, scrubCrashEvent } from '../privacy';

const id='3ae1bd06-d6ab-4899-9c66-ad03d2809839';
const base: ErrorEvent={type:undefined,event_id:'a'.repeat(32),exception:{values:[{type:'Error',value:'Unexpected state',stacktrace:{frames:[{filename:'app:///main.jsbundle',lineno:3,colno:4}]}}]}};
function withImage(debug_id: string, code_file = 'app:///main.jsbundle') {
  const image: DebugImage & { opaque:string }={type:'sourcemap',debug_id,code_file,opaque:'discarded'};
  const debug_meta={images:[image],opaque:'discarded'};
  return {...base,debug_meta};
}

test('only the UUID build ID and canonical code file survive both filters; extra metadata is dropped', async () => {
  const expected={images:[{type:'sourcemap',debug_id:id,code_file:'app:///main.jsbundle'}]};
  const scrubbed=scrubCrashEvent(withImage(id),{},'/shop');
  expect(scrubbed?.debug_meta).toEqual(expected);
  expect(scrubbed?.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({filename:'app:///main.jsbundle',lineno:3,colno:4});
  const sent: Envelope[]=[];
  const transport=guardCrashTransport({send:async envelope=>{sent.push(envelope);return {};},flush:async()=>true},()=>'/shop');
  if (!scrubbed) throw new Error('Technical error was rejected');
  await transport.send([{event_id:'a'.repeat(32),sent_at:'2026-11-13T00:00:00Z'},[[{type:'event'},scrubbed]]]);
  expect(sent).toHaveLength(1);
  expect(sent[0][1][0][1]).toMatchObject({debug_meta:expected,sdk:{settings:{infer_ip:'never'}}});
  expect(JSON.stringify(sent)).not.toContain('discarded');
});

test.each(['not-a-uuid','3ae1bd06-d6ab-4899-9c66-ad03d2809839suffix',''])('does not allow invalid Debug ID %s', invalid => {
  const result=scrubCrashEvent(withImage(invalid),{},'/shop');
  expect(result).not.toBeNull();
  expect(result?.debug_meta).toBeUndefined();
});

test('does not allow arbitrary metadata filenames', () => {
  const result=scrubCrashEvent(withImage(id,'app:///unrecognized.js'),{},'/shop');
  expect(result).not.toBeNull();
  expect(result?.debug_meta).toBeUndefined();
});

test('a valid UUID with vocabulary-like hex is still a technical ID, not free-form data', () => {
  const buildId='face0000-0000-4000-8000-000000000000';
  expect(scrubCrashEvent(withImage(buildId),{},'/shop')?.debug_meta).toEqual({images:[{type:'sourcemap',debug_id:buildId,code_file:'app:///main.jsbundle'}]});
});
