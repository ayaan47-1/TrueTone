import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserClient } from '@sentry/browser';
import { Scope } from '@sentry/core';
import type { Envelope } from '@sentry/core';
import { debugMetaIntegration } from '@sentry/react-native/dist/js/integrations/debugmeta';
import { z } from 'zod';
import { guardCrashTransport, scrubCrashEvent } from '../../src/lib/crash-reporting/privacy';

test('built Hermes bundle and map ID reaches the outgoing envelope through the real SDK integration and both filters', async () => {
  const directory=process.env.SENTRY_TEST_ARTIFACT_DIR;
  if (!directory) throw new Error('Export iOS with --source-maps and set SENTRY_TEST_ARTIFACT_DIR');
  const ios=join(directory,'_expo/static/js/ios');
  const maps=readdirSync(ios).filter(name=>name.endsWith('.hbc.map'));
  expect(maps).toHaveLength(1);
  const map=z.object({debugId:z.string().uuid()}).parse(JSON.parse(readFileSync(join(ios,maps[0]),'utf8')));
  const bundle=readFileSync(join(ios,maps[0].slice(0,-4)));
  expect(bundle.includes(Buffer.from(map.debugId))).toBe(true);

  const previous=Object.getOwnPropertyDescriptor(globalThis,'_sentryDebugIds');
  Object.defineProperty(globalThis,'_sentryDebugIds',{value:{'artifact premodule':map.debugId},configurable:true});
  const envelopes:Envelope[]=[];
  const client=new BrowserClient({
    dsn:'https://public@example.invalid/1',stackParser:()=>[],integrations:[debugMetaIntegration()],sendClientReports:false,
    beforeSend:(event,hint)=>scrubCrashEvent(event,hint,'/shop'),
    transport:()=>guardCrashTransport({send:async envelope=>{envelopes.push(envelope);return {statusCode:200};},flush:async()=>true},()=>'/shop'),
  });
  try {
    client.init();
    const scope=new Scope();scope.setClient(client);
    scope.captureEvent({exception:{values:[{type:'Error',value:'Unexpected state',stacktrace:{frames:[{filename:'app:///main.jsbundle',lineno:1,colno:1}]}}]}});
    await client.flush();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0][1][0][1]).toMatchObject({
      debug_meta:{images:[{type:'sourcemap',debug_id:map.debugId,code_file:'app:///main.jsbundle'}]},
      exception:{values:[{stacktrace:{frames:[{filename:'app:///main.jsbundle',lineno:1,colno:1}]}}]},
      sdk:{settings:{infer_ip:'never'}},
    });
  } finally {
    await client.close();
    if(previous) Object.defineProperty(globalThis,'_sentryDebugIds',previous);
    else Reflect.deleteProperty(globalThis,'_sentryDebugIds');
  }
});
