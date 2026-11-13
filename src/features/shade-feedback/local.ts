import { z } from 'zod';
import { localAnswerSchema } from './contract';

const entrySchema=localAnswerSchema.safeExtend({submitted_at:z.iso.datetime()});
type Storage = {getAllKeys():Promise<readonly string[]>;getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>};
export function createLocalFeedback(storage:Storage) {
  const key = (owner:string) => `truetone.shadeFeedback.${owner}`;
  let writes:Promise<unknown>=Promise.resolve();
  function exclusive<T>(work:()=>Promise<T>):Promise<T> {
    const next=writes.then(work); writes=next.catch(()=>undefined); return next;
  }
  async function list(owner:string) {
    const raw=await storage.getItem(key(owner));
    if (!raw) return [];
    const entries=z.array(entrySchema).max(50).parse(JSON.parse(raw));
    const cutoff=Date.now()-365*24*60*60*1000;
    const current=entries.filter(entry=>Date.parse(entry.submitted_at)>=cutoff);
    if (current.length!==entries.length) {
      if(current.length) await storage.setItem(key(owner),JSON.stringify(current));
      else await storage.removeItem(key(owner));
    }
    return current;
  }
  return {
    list:(owner:string)=>exclusive(()=>list(owner)),
    async save(owner:string,value:unknown) {
      const answer=localAnswerSchema.parse(value);
      return exclusive(async()=>{
        const entries=await list(owner);
        const next=[{...answer,submitted_at:new Date().toISOString()},...entries.filter(entry=>entry.variant_gid!==answer.variant_gid)].slice(0,50);
        await storage.setItem(key(owner),JSON.stringify(next));
      });
    },
    clear(owner:string) { return exclusive(async()=>{
      let count=0;
      try {count=(await list(owner)).length;} catch { /* Unreadable records must still be deletable. */ }
      await storage.removeItem(key(owner));
      return count;
    }); },
    clearAll() { return exclusive(async()=>{const keys=(await storage.getAllKeys()).filter(value=>value.startsWith('truetone.shadeFeedback.'));await Promise.all(keys.map(value=>storage.removeItem(value)));}); },
  };
}
