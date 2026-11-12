import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, GlassCard, Heading, Screen, HEADER_CLEARANCE } from '../src/components/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useProfile } from '../src/lib/profile-context';
import { ShadeFeedbackScreen } from '../src/features/shade-feedback/ShadeFeedbackScreen';
import { feedbackCleanup, localFeedback } from '../src/features/shade-feedback/runtime';
import { FeedbackCleanupNotice } from '../src/features/shade-feedback/FeedbackCleanupNotice';

export default function ShadeFeedbackRoute() {
  const {userId,route,loading,error}=useProfile();
  const {variant}=useLocalSearchParams<{variant:string}>();
  const router=useRouter();
  const canSave=useSyncExternalStore(feedbackCleanup.subscribe,feedbackCleanup.canSave,feedbackCleanup.canSave);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{
    let current=true;
    if (!loading && !error && route==='home' && userId) {
      setChecking(true);
      void feedbackCleanup.retry().catch(()=>undefined).finally(()=>{if(current)setChecking(false);});
    } else setChecking(false);
    return ()=>{current=false;};
  },[loading,error,route,userId]);
  async function retry() {
    if(checking)return;
    setChecking(true);
    try {await feedbackCleanup.retry();} catch { /* The card remains retryable. */ }
    finally {setChecking(false);}
  }
  const valid=!error && route==='home' && !!userId && /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant??'');
  if (loading || !valid || checking || !canSave) return <Screen className="px-6" topGap={HEADER_CLEARANCE} bottomGap={24} scrollTestID="shade-feedback-state">
    {loading || (valid && checking)?<FeedbackCleanupNotice state="checking" />:!valid?<GlassCard className="my-3 px-5 py-4 gap-3"><Heading>Feedback unavailable</Heading><Body>Choose a reviewed shade before answering.</Body></GlassCard>:<FeedbackCleanupNotice state="blocked" onRetry={()=>void retry()} />}
  </Screen>;
  return <ShadeFeedbackScreen variantId={variant} save={answer=>localFeedback.save(userId,answer)} onClose={()=>router.back()} />;
}
