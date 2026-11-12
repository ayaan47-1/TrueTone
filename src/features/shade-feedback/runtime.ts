import { encryptedStorage } from '../../lib/encrypted-storage';
import { supabase, SUPABASE_OFFLINE } from '../../lib/supabase';
import { createLocalFeedback } from './local';
import { createFeedbackService } from './service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFeedbackCleanup } from './cleanup';
import { readFeedbackConsent } from '../../lib/feedback-consent';

const answers=createLocalFeedback(encryptedStorage);
// This content-free marker is independent of the encrypted answers and their key.
export const feedbackCleanup=createFeedbackCleanup(AsyncStorage,():Promise<void>=>localFeedback.clearAll(),{
  readConsent:readFeedbackConsent,
  hasFeedback:async()=>(await encryptedStorage.getAllKeys()).some(key=>key.startsWith('truetone.shadeFeedback.')),
});
export const localFeedback={...answers,save:(owner:string,value:unknown):Promise<void>=>feedbackCleanup.save(()=>answers.save(owner,value))};
export const feedbackService=createFeedbackService((name,args)=>supabase.rpc(name,args));
export async function clearAllLocalFeedback() {
  await feedbackCleanup.clear();
}
export async function deleteOwnedFeedback(owner:string) {
  // Always remove the local copy, even if the first-party service is unavailable.
  const results=await Promise.allSettled([localFeedback.clear(owner),...(!SUPABASE_OFFLINE?[feedbackService.clear()]:[])]);
  if(results.some(result=>result.status==='rejected')) throw new Error('Feedback deletion incomplete');
}
