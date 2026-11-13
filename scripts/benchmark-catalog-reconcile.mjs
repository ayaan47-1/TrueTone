// Local synthetic transport only. No Shopify or Supabase network requests.
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,writeFileSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { ShopifyCatalogue as Current } from '../supabase/functions/_shared/catalog/shopify.ts';
import { reconcileCatalogue } from '../supabase/functions/_shared/catalog/sync.ts';

const temp=mkdtempSync(join(tmpdir(),'truetone-reconcile-baseline-'));
for(const file of ['shopify.ts','contracts.ts']) writeFileSync(join(temp,file),execFileSync('git',['show',`546e427:supabase/functions/_shared/catalog/${file}`]));
symlinkSync(resolve('node_modules'),join(temp,'node_modules'));
const {ShopifyCatalogue:Baseline}=await import(pathToFileURL(join(temp,'shopify.ts')).href);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const count=3000;
const delay=Number(process.env.MOCK_LATENCY_MS||10);
const repeats=Number(process.env.BENCH_REPEATS||5);
assert.ok(Number.isFinite(delay)&&delay>=0&&delay<=50&&Number.isInteger(repeats)&&repeats>0&&repeats<=5);
const results=[];
for(let repeat=1;repeat<=repeats;repeat++) {
  for(const [name,Adapter] of (repeat%2?[['before',Baseline],['after',Current]]:[['after',Current],['before',Baseline]])) {
    let requests=0,active=0,peak=0,complete=false;
    const saved=new Set();
    const pageInfo=(after)=>({hasNextPage:after<count,endCursor:after<count?String(after):null});
    const source=new Adapter({shop:'benchmark.myshopify.com',accessToken:'synthetic-not-a-key',publicationId:'gid://shopify/Publication/1',onlineLocationIds:['gid://shopify/Location/1'],
      fetcher:async(url,init)=>{
        assert.equal(url,'https://benchmark.myshopify.com/admin/api/2026-10/graphql.json');
        requests++;active++;peak=Math.max(peak,active);
        await wait(delay);active--;
        const {variables}=JSON.parse(init.body);
        let data;
        if(!variables.id) {
          const from=Number(variables.after||0);
          data={products:{nodes:Array.from({length:Math.min(100,count-from)},(_,n)=>({id:`gid://shopify/Product/${from+n+1}`})),pageInfo:pageInfo(from+100)}};
        } else {
          const n=variables.id.split('/').at(-1),end={hasNextPage:false,endCursor:null};
          data={shop:{currencyCode:'USD'},product:{id:variables.id,title:`Synthetic ${n}`,vendor:'Synthetic',status:'ACTIVE',publishedOnPublication:true,formula:null,
            variants:{nodes:[{id:`gid://shopify/ProductVariant/${n}`,title:'Synthetic neutral',sku:null,barcode:null,price:'35.00',
              inventoryItem:{id:`gid://shopify/InventoryItem/${n}`,inventoryLevels:{nodes:[{location:{id:'gid://shopify/Location/1'},quantities:[{name:'available',quantity:5}]}],pageInfo:end}}}],pageInfo:end}}};
        }
        return Response.json({data,extensions:{cost:{requestedQueryCost:100,actualQueryCost:5,throttleStatus:{maximumAvailable:100000,currentlyAvailable:99000,restoreRate:100000}}}});
      }});
    const started=performance.now();
    await reconcileCatalogue({shopify:source,store:{beginReconcile:async()=>{},failReconcile:async()=>assert.fail('unexpected reconcile failure'),
      applyProduct:async product=>{assert.equal(complete,false);await wait(1);saved.add(product.product_gid);},
      finishReconcile:async ids=>{assert.equal(ids.length,count);assert.equal(saved.size,count);complete=true;}}});
    const result={name,repeat,products:saved.size,requests,peak,completed:complete,elapsedMs:performance.now()-started,mockNetworkMs:delay,mockPersistenceMs:1};
    assert.equal(complete,true);assert.equal(requests,3030);
    results.push(result);console.log(JSON.stringify(result));
  }
}
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify({note:'Unthrottled synthetic cost bucket; isolates request latency and persistence, not real Shopify plan throughput.',results},null,2));
