import type { Product } from '../match/match-types';
import type { CatalogueRepository } from './repository';

export interface CatalogueSnapshot {
  status: 'idle'|'loading'|'ready'|'empty'|'offline'|'demo';
  products: readonly Product[];
  previousProducts: readonly Product[];
  hasMore?:boolean;
  hasPrevious?:boolean;
}

export function createCatalogueState(repository:CatalogueRepository,options:{offline?:boolean;demo?:readonly Product[];now?:()=>number}={}) {
  const now=options.now??(()=>performance.now());
  let state:CatalogueSnapshot={status:options.offline?'offline':options.demo?'demo':'idle',products:options.demo??[],previousProducts:[],hasMore:false};
  let cached:readonly Product[]=[];
  let revision:string|null=null,cursor:string|null=null;
  let currentAfter:string|null=null;
  let history:(string|null)[]=[];
  let expiresAt=0,verifiedAt=-Infinity;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogueSnapshot) => { state = next; listeners.forEach(listener => listener()); };
  const read=(force:boolean,move:0|1|-1):Promise<void>=>{
    if(options.offline || options.demo) return Promise.resolve();
    if(pending) return pending;
    if(move===0 && !force && now()-verifiedAt<60_000 && now()<expiresAt) return Promise.resolve();
    if(move===1 && !cursor || move===-1 && !history.length) return Promise.resolve();
    const previousProducts=state.products.length?state.products:state.previousProducts;
    publish({status:'loading',products:[],previousProducts,hasMore:false});
    pending=Promise.resolve().then(async()=>{
      try {
        const checkedAt=now();
        const meta=await repository.revision();
        const unchanged=revision===meta.revision && now()<expiresAt;
        if(move!==0 || !unchanged) {
          const after=unchanged?(move===1?cursor:history.at(-1)??null):null;
          const page=await repository.page(after);
          const deadline=checkedAt+meta.ttlMs;
          if(now()>=deadline) throw Error('catalogue freshness expired during download');
          if(!unchanged) history=[];
          else if(move===1) history.push(currentAfter);
          else if(move===-1) history.pop();
          cached=page.products;cursor=page.nextCursor;currentAfter=after;
          revision=meta.revision;expiresAt=deadline;
        }
        verifiedAt=now();
        publish({status:cached.length?'ready':'empty',products:cached,previousProducts,hasMore:cursor!==null,hasPrevious:history.length>0});
      } catch {
        verifiedAt=-Infinity;
        publish({status:'offline',products:[],previousProducts,hasMore:false});
      } finally {pending=null;}
    });
    return pending;
  };
  return {getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    load:(force=false)=>read(force,0),loadMore:()=>read(true,1),loadPrevious:()=>read(true,-1)};
}
