import { Scope } from '@sentry/core';
import { BrowserClient } from '@sentry/browser';
import type { Envelope } from '@sentry/core';
import { guardCrashTransport, scrubCrashEvent } from '../privacy';

test('actual SDK event processing sends only the scrubbed error, never scope attachments or private context', async () => {
  const envelopes: Envelope[] = [];
  let route = '/shop';
  const client = new BrowserClient({
    dsn: 'https://public@example.invalid/1', stackParser: () => [], integrations: [],
    sendClientReports: false,
    transport: () => guardCrashTransport({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }, () => route),
    beforeSend: (event, hint) => scrubCrashEvent(event, hint, route),
  });
  client.init();
  const scope = new Scope();
  scope.setClient(client);
  scope.setExtra('opaque', 'PRIVATE_CONTEXT');
  scope.addAttachment({ filename: 'face.jpg', data: 'PRIVATE_IMAGE' });
  const event = { exception: { values: [{ type: 'TypeError', value: 'Unexpected state', stacktrace: { frames: [{ filename: 'app:///main.js', lineno: 17 }] } }] } };
  scope.captureEvent(event);
  await client.flush();
  expect(envelopes).toHaveLength(1);
  expect(envelopes[0][1]).toHaveLength(1);
  expect(envelopes[0][1][0][0].type).toBe('event');
  expect(envelopes[0][1][0][1]).toMatchObject({ sdk:{ name:'sentry.javascript.react-native',version:'8.35.0',settings:{infer_ip:'never'} } });
  const payload = JSON.stringify(envelopes);
  for (const forbidden of ['private-user', 'jane@example.com', 'private skin type', 'face.jpg', 'PRIVATE_IMAGE', 'PRIVATE_SCORE']) expect(payload).not.toContain(forbidden);
  expect(payload).toContain('TypeError');
  expect(payload).toContain('17');
  scope.setUser({id:'private-user',email:'jane@example.com'});
  scope.captureEvent(event);
  await client.flush();
  expect(envelopes).toHaveLength(1);
  route = '/scan';
  scope.captureEvent(event);
  await client.flush();
  expect(envelopes).toHaveLength(1);
  await client.close();
});

test('final transport rejects raw sensitive SDK-internal errors before parsing, and drops every non-error item', async () => {
  const sent: Envelope[] = [];
  let route = '/shop';
  const transport = guardCrashTransport({ send: async envelope => { sent.push(envelope); return {}; }, flush: async () => true }, () => route);
  await transport.send([{ event_id:'a'.repeat(32), sent_at:'2026-11-13T00:00:00Z', trace: { transaction: 'private-user' } }, [
    [{type:'event'}, {event_id:'a'.repeat(32), user:{id:'private-user'}, exception:{values:[{type:'Error',value:'PRIVATE',stacktrace:{frames:[{filename:'app:///main.js',lineno:3}]}}]} }],
    [{type:'attachment',filename:'face.jpg',length:13}, 'PRIVATE_IMAGE'],
  ]]);
  expect(sent).toHaveLength(0);
  await transport.send([{event_id:'a'.repeat(32),sent_at:'2026-11-13T00:00:00Z'},[
    [{type:'event'},{event_id:'a'.repeat(32),exception:{values:[{type:'Error',value:'Unexpected state',stacktrace:{frames:[{filename:'app:///main.js',lineno:3}]}}]}}],
    [{type:'attachment',filename:'face.jpg',length:13},'PRIVATE_IMAGE'],
  ]]);
  expect(sent).toHaveLength(1);
  expect(sent[0][0]).toEqual({ event_id:'a'.repeat(32), sent_at:expect.any(String) });
  expect(sent[0][1]).toHaveLength(1);
  for (const forbidden of ['private-user','PRIVATE','face.jpg','private-session']) expect(JSON.stringify(sent)).not.toContain(forbidden);
  route = '/scan';
  await transport.send(sent[0]);
  expect(sent).toHaveLength(1);
  expect(await transport.flush()).toBe(true);
});

test.each(['shade score for account 123', 'routine recommendation', 'jane@example.com'])('bypassing raw exception canary is rejected before schema projection: %s', value => {
  const send = jest.fn(async (_envelope:Envelope) => ({}));
  const transport=guardCrashTransport({send,flush:async()=>true},()=>'/shop');
  void transport.send([{event_id:'a'.repeat(32),sent_at:'2026-11-13T00:00:00Z'},[[{type:'event'},{event_id:'a'.repeat(32),exception:{values:[{type:'Error',value,stacktrace:{frames:[{filename:'app:///main.js',lineno:3}]}}]}}]]]);
  expect(send).not.toHaveBeenCalled();
});
