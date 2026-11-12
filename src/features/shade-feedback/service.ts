import { SERVER_FEEDBACK_ENABLED } from './flags';
import { parseFeedback, feedbackPageSchema } from './contract';

type Rpc = (name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export function createFeedbackService(rpc:Rpc) {
  return {
    async list(offset=0) {
      const {data,error}=await rpc('list_shade_feedback',{p_offset:offset});
      if(error) throw new Error('Could not read feedback');
      return feedbackPageSchema.parse(data);
    },
    async withdraw() {
      const {error}=await rpc('set_shade_feedback_consent',{p_action:'withdrawn'});
      if(error) throw new Error('Could not withdraw optional consent');
    },
    async submit(value:unknown,separatelyConsented:boolean) {
      if (!SERVER_FEEDBACK_ENABLED || !separatelyConsented) return {kind:'disabled' as const};
      try {
        const payload=parseFeedback(value);
        const result=await rpc('record_shade_feedback',{p_event:payload});
        return result.error ? {kind:'unavailable' as const} : {kind:'saved' as const};
      } catch { return {kind:'unavailable' as const}; }
    },
    async clear() {
      // Deletion remains available even when collection is disabled.
      const {data,error}=await rpc('delete_shade_feedback');
      if (error || typeof data!=='number') throw new Error('Could not delete feedback');
      return data;
    },
  };
}
