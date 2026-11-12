import { encryptedStorage } from '../../lib/encrypted-storage';
import { supabase, SUPABASE_OFFLINE } from '../../lib/supabase';
import { createLocalFeedback } from './local';
import { createFeedbackService } from './service';

export const localFeedback=createLocalFeedback(encryptedStorage);
export const feedbackService=createFeedbackService((name,args)=>supabase.rpc(name,args));
export async function clearAllLocalFeedback() {
  await localFeedback.clearAll();
}
export async function deleteOwnedFeedback(owner:string) {
  // Always remove the local copy, even if the first-party service is unavailable.
  const results=await Promise.allSettled([localFeedback.clear(owner),...(!SUPABASE_OFFLINE?[feedbackService.clear()]:[])]);
  if(results.some(result=>result.status==='rejected')) throw new Error('Feedback deletion incomplete');
}
