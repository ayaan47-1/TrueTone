import { encryptedStorage } from '../../lib/encrypted-storage';
import { supabase, SUPABASE_OFFLINE } from '../../lib/supabase';
import { createLocalFeedback } from './local';
import { createFeedbackService } from './service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFeedbackCleanup } from './cleanup';

export const localFeedback=createLocalFeedback(encryptedStorage);
// This content-free marker is independent of the encrypted answers and their key.
export const feedbackCleanup=createFeedbackCleanup(AsyncStorage,()=>localFeedback.clearAll());
export const feedbackService=createFeedbackService((name,args)=>supabase.rpc(name,args));
export async function clearAllLocalFeedback() {
  await feedbackCleanup.clear();
}
export async function deleteOwnedFeedback(owner:string) {
  // Always remove the local copy, even if the first-party service is unavailable.
  const results=await Promise.allSettled([localFeedback.clear(owner),...(!SUPABASE_OFFLINE?[feedbackService.clear()]:[])]);
  if(results.some(result=>result.status==='rejected')) throw new Error('Feedback deletion incomplete');
}
