import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, PrimaryButton } from '../src/components/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { useProfile } from '../src/lib/profile-context';
import { ShadeFeedbackScreen } from '../src/features/shade-feedback/ShadeFeedbackScreen';
import { feedbackCleanup, localFeedback } from '../src/features/shade-feedback/runtime';
import { FeedbackCleanupNotice } from '../src/features/shade-feedback/FeedbackCleanupNotice';

export default function ShadeFeedbackRoute() {
  const {userId,route,loading,error}=useProfile();
  const {variant}=useLocalSearchParams<{variant:string}>();
  const router=useRouter();
  const canSave=useSyncExternalStore(feedbackCleanup.subscribe,feedbackCleanup.canSave,feedbackCleanup.canSave);
  useEffect(()=>{
    if (!loading && !error && route==='home' && userId) void feedbackCleanup.retry().catch(()=>undefined);
  },[loading,error,route,userId]);
  if (loading || error || route!=='home' || !userId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant??'')) return <Body>Choose a reviewed shade before answering.</Body>;
  if (!canSave) return <><Body>Feedback is unavailable until consent and local cleanup are confirmed.</Body><FeedbackCleanupNotice /><PrimaryButton label="Check again" onPress={()=>{void feedbackCleanup.retry().catch(()=>undefined);}} /></>;
  return <ShadeFeedbackScreen variantId={variant} save={answer=>localFeedback.save(userId,answer)} onClose={()=>router.back()} />;
}
