import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseCatalogueStore } from '../../supabase/functions/_shared/catalog/store.ts';

test('persistence uses service-only RPCs, sends only explicit product snapshots', async () => {
  const requests = [];
  const store = new SupabaseCatalogueStore({ url: 'http://127.0.0.1:54321', serviceKey: 'synthetic', fetcher: async (url, request) => {
    requests.push([url, request]);
    return Response.json('claimed');
  } });
  assert.equal(await store.claim('event', 'products/update'), 'claimed');
  await store.applyProduct({ product_gid: 'p1', variants: [] }, '2026-11-12T00:00:00Z');
  assert.equal(requests[0][0], 'http://127.0.0.1:54321/rest/v1/rpc/catalog_claim_event');
  assert.deepEqual(JSON.parse(requests[1][1].body), { p_snapshot: { product_gid: 'p1', variants: [] }, p_observed_at: '2026-11-12T00:00:00Z' });
  assert.equal(requests[0][1].headers.Authorization, 'Bearer synthetic');
});

test('database error responses are retriable, without reflecting database content', async () => {
  const store = new SupabaseCatalogueStore({ url: 'https://example.supabase.co', serviceKey: 'synthetic', fetcher: async () => new Response('sensitive internal body', { status: 500 }) });
  await assert.rejects(store.complete('event'), error => error.message === 'catalogue persistence failed');
});

test('insecure nonlocal persistence URLs are rejected', () => {
  assert.throws(() => new SupabaseCatalogueStore({ url: 'http://example.com', serviceKey: 'synthetic' }));
});

test('catalogue persistence rejects307/308 without forwarding the service credentials',async()=>{
  for(const status of [307,308]) {
    const requests=[];
    const store=new SupabaseCatalogueStore({url:'https://example.supabase.co',serviceKey:'synthetic-only',fetcher:async(url,init)=>{
      requests.push({url,init});
      const redirect=new Response(null,{status,headers:{Location:'https://untrusted.example/collect'}});
      if(init.redirect==='error') return redirect;
      requests.push({url:redirect.headers.get('Location'),init});
      return Response.json('claimed');
    }});
    await assert.rejects(()=>store.claim('event','products/update'),/catalogue persistence failed/);
    assert.equal(requests.length,1);
    assert.equal(requests[0].init.redirect,'error');
  }
});
