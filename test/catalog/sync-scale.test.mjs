import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShopifyCatalogue } from '../../supabase/functions/_shared/catalog/shopify.ts';
import { createReconcileHandler, createWebhookHandler } from '../../supabase/functions/_shared/catalog/sync.ts';

const config={shop:'synthetic.myshopify.com',accessToken:'not-a-real-token',publicationId:'gid://shopify/Publication/1',onlineLocationIds:['gid://shopify/Location/1']};
const end={hasNextPage:false,endCursor:null};
const snapshot=id=>({product_gid:id,variants:[]});

test('unseen 250-point product queries never overdraw a partially depleted 1000-point bucket',async()=>{
  let balance=1000,last=Date.now(),throttles=0;
  const source=new ShopifyCatalogue({...config,fetcher:async(_url,init)=>{
    const {variables}=JSON.parse(init.body),cost=variables.id?250:150;
    const now=Date.now();balance=Math.min(1000,balance+(now-last)*10);last=now;
    const allowed=balance>=cost;
    if(allowed)balance-=cost;else throttles++;
    const extensions={cost:{requestedQueryCost:cost,actualQueryCost:allowed?cost:null,throttleStatus:{maximumAvailable:1000,currentlyAvailable:balance,restoreRate:10000}}};
    const data=variables.id?{shop:{currencyCode:'USD'},product:{id:variables.id,title:'Synthetic',vendor:'Synthetic',status:'ACTIVE',publishedOnPublication:true,formula:null,variants:{nodes:[],pageInfo:end}}}:
      {products:{nodes:Array.from({length:8},(_,i)=>({id:`gid://shopify/Product/${i}`})),pageInfo:end}};
    await new Promise(resolve=>setTimeout(resolve,2));
    return Response.json(allowed?{data,extensions}:{errors:[{extensions:{code:'THROTTLED'}}],extensions});
  }});
  assert.equal((await source.page(null)).products.length,8);
  assert.equal(throttles,0);
});

test('continuation restores and persists learned requested costs even when its page fails',async()=>{
  let restored,persisted;
  const handler=createReconcileHandler({secret:'synthetic',logger:()=>{},store:{
    claimReconcile:async()=>({id:'00000000-0000-4000-8000-000000000001',lease_token:'00000000-0000-4000-8000-000000000002',cursor:null,started_at:'2026-11-13T00:00:00Z',query_costs:{product:250}}),
    retryReconcile:async(job)=>{persisted=job.query_costs;},
  },shopify:{restoreCosts:costs=>{restored=costs;},queryCosts:()=>({product:250,inventory:100}),page:async()=>{throw Error('synthetic');}}});
  await handler(new Request('https://local.invalid/job',{method:'POST',headers:{authorization:'Bearer synthetic'},body:'{}'}));
  assert.deepEqual(restored,{product:250});
  assert.deepEqual(persisted,{product:250,inventory:100});
});

test('Shopify throttling is classified and never retried in a hot loop',async()=>{
  let calls=0;
  const source=new ShopifyCatalogue({...config,fetcher:async()=>{calls++;return Response.json({errors:[{message:'private response',extensions:{code:'THROTTLED'}}]});}});
  await assert.rejects(source.page(null),error=>error.code==='shopify_throttled');
  assert.equal(calls,1);
});

test('expired invocation budget makes no further upstream requests',async t=>{
  let now=Date.now(),calls=0;
  t.mock.method(Date,'now',()=>now);
  const source=new ShopifyCatalogue({...config,fetcher:async()=>{calls++;throw Error('must not fetch');}});
  now+=96_000;
  await assert.rejects(source.page(null),error=>error.code==='deadline');
  assert.equal(calls,0);
});

test('remote cost availability delays subsequent requests rather than ignoring a depleted bucket',async()=>{
  const times=[];
  const source=new ShopifyCatalogue({...config,fetcher:async(_url,init)=>{
    times.push(performance.now());
    const {variables}=JSON.parse(init.body);
    const data=!variables.id?{products:{nodes:[{id:'gid://shopify/Product/1'}],pageInfo:end}}:
      {shop:{currencyCode:'USD'},product:{id:variables.id,title:'Synthetic',vendor:'Synthetic',status:'ACTIVE',publishedOnPublication:true,formula:null,variants:{nodes:[],pageInfo:end}}};
    return Response.json({data,extensions:{cost:{requestedQueryCost:150,actualQueryCost:150,throttleStatus:{maximumAvailable:150,currentlyAvailable:0,restoreRate:1000}}}});
  }});
  await source.page(null);
  assert.equal(times.length,2);
  assert.ok(times[1]-times[0]>=100);
});

test('one page fetches products concurrently with a bound and preserves source order',async()=>{
  let active=0,peak=0;
  const source=new ShopifyCatalogue({...config,fetcher:async(_url,init)=>{
    assert.equal(init.redirect,'error');
    const {variables}=JSON.parse(init.body);
    const extensions={cost:{requestedQueryCost:80,actualQueryCost:2,throttleStatus:{maximumAvailable:1000,currentlyAvailable:900,restoreRate:100}}};
    if(!variables.id) return Response.json({extensions,data:{products:{nodes:Array.from({length:19},(_,i)=>({id:`gid://shopify/Product/${i}`})),pageInfo:end}}});
    active++;peak=Math.max(peak,active);
    await new Promise(r=>setTimeout(r,2));active--;
    return Response.json({extensions,data:{shop:{currencyCode:'USD'},product:{id:variables.id,title:'Synthetic',vendor:'Synthetic',status:'ACTIVE',publishedOnPublication:true,formula:null,variants:{nodes:[],pageInfo:end}}}});
  }});
  const page=await source.page(null);
  assert.equal(page.products.length,19);
  assert.equal(page.products[18].product_gid,'gid://shopify/Product/18');
  assert.equal(page.nextCursor,null);
  assert.ok(peak>1 && peak<=8,`peak=${peak}`);
});

test('a throttled page never checkpoints or completes and logs no arbitrary error contents',async()=>{
  const calls=[],logs=[];
  const handler=createReconcileHandler({secret:'synthetic',logger:record=>logs.push(record),store:{
    claimReconcile:async()=>({id:'00000000-0000-4000-8000-000000000001',lease_token:'00000000-0000-4000-8000-000000000002',cursor:null,started_at:'2026-11-13T00:00:00Z'}),
    checkpointReconcile:async()=>calls.push('checkpoint'),retryReconcile:async()=>calls.push('retry'),
  },shopify:{page:async()=>{throw Error('secret customer@example.invalid');}}});
  const response=await handler(new Request('https://local.invalid/job',{method:'POST',headers:{authorization:'Bearer synthetic'},body:'{}'}));
  assert.equal(response.status,503);
  assert.deepEqual(calls,['retry']);
  assert.deepEqual(logs,[{event:'catalog_reconcile_failed',code:'operation_failed'}]);
  assert.ok(!JSON.stringify(logs).includes('customer@'));
});

test('resumes saved cursor and checkpoints only complete pages before completion',async()=>{
  const calls=[];
  const handler=createReconcileHandler({secret:'synthetic',store:{
    claimReconcile:async()=>({id:'00000000-0000-4000-8000-000000000001',lease_token:'00000000-0000-4000-8000-000000000002',cursor:'page-2',started_at:'2026-11-13T00:00:00Z'}),
    checkpointReconcile:async(job,page)=>calls.push([job.cursor,page.nextCursor,page.products.map(p=>p.product_gid)]),
    retryReconcile:async()=>calls.push('retry'),
  },shopify:{page:async cursor=>({products:[snapshot('gid://shopify/Product/2')],nextCursor:null})}});
  const response=await handler(new Request('https://local.invalid/job',{method:'POST',headers:{authorization:'Bearer synthetic'},body:'{}'}));
  assert.equal(response.status,200);
  assert.deepEqual(calls,[['page-2',null,['gid://shopify/Product/2']]]);
});

test('normal invocation yield is checkpointed and is not logged as a failed attempt',async()=>{
  const calls=[];let ticks=0;
  const handler=createReconcileHandler({secret:'synthetic',now:()=>ticks++?76_000:0,store:{
    claimReconcile:async()=>({id:'00000000-0000-4000-8000-000000000001',lease_token:'00000000-0000-4000-8000-000000000002',cursor:null,started_at:'2026-11-13T00:00:00Z'}),
    checkpointReconcile:async()=>calls.push('checkpoint'),retryReconcile:async(job,failed)=>calls.push([job.cursor,failed]),
  },shopify:{page:async()=>({products:[snapshot('gid://shopify/Product/1')],nextCursor:'next'})}});
  const response=await handler(new Request('https://local.invalid/job',{method:'POST',headers:{authorization:'Bearer synthetic'},body:'{}'}));
  assert.equal(response.status,202);
  assert.deepEqual(calls,['checkpoint',['next',false]]);
});
